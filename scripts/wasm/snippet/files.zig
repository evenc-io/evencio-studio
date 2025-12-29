const std = @import("std");
const common = @import("common.zig");

const allocator = common.allocator;

const MAGIC: u32 = 0x534E4950; // "SNIP"
const VERSION: u32 = 1;
const FLAG_HAS_FILE_BLOCKS: u32 = 1;
const MAX_IMPORT_DEPTH: usize = 20;

const FileEntry = struct {
    name: []const u8,
    content: []u8,
};

const LineMapSegment = struct {
    file_index: u32,
    expanded_start_line: u32,
    original_start_line: u32,
    line_count: u32,
};

const ParseResult = struct {
    main_source: []u8,
    files: std.ArrayList(FileEntry),
    file_indices: std.StringHashMap(usize),
    has_file_blocks: bool,
};

fn trimEndWhitespace(value: []const u8) []const u8 {
    var end = value.len;
    while (end > 0 and common.isWhitespace(value[end - 1])) {
        end -= 1;
    }
    return value[0..end];
}

fn appendLine(out: *std.ArrayList(u8), line: []const u8) !void {
    if (out.items.len > 0) {
        try out.append(allocator, '\n');
    }
    try out.appendSlice(allocator, line);
}

fn finalizeBuilder(out: *std.ArrayList(u8)) ![]u8 {
    var end = out.items.len;
    while (end > 0 and common.isWhitespace(out.items[end - 1])) {
        end -= 1;
    }
    out.items.len = end;
    return out.toOwnedSlice(allocator);
}

fn matchDirective(line: []const u8, directive: []const u8) ?[]const u8 {
    var i: usize = 0;
    while (i < line.len and common.isWhitespace(line[i])) : (i += 1) {}
    if (i + 1 >= line.len or line[i] != '/' or line[i + 1] != '/') return null;
    i += 2;
    while (i < line.len and common.isWhitespace(line[i])) : (i += 1) {}
    if (i + directive.len > line.len) return null;
    if (!std.mem.eql(u8, line[i .. i + directive.len], directive)) return null;
    i += directive.len;
    return line[i..];
}

fn matchFileStart(line: []const u8) ?[]const u8 {
    const rest = matchDirective(line, "@snippet-file") orelse return null;
    var i: usize = 0;
    var saw_space = false;
    while (i < rest.len and common.isWhitespace(rest[i])) : (i += 1) {
        saw_space = true;
    }
    if (!saw_space) return null;
    if (i >= rest.len) return null;
    return trimEndWhitespace(rest[i..]);
}

fn isFileEnd(line: []const u8) bool {
    const rest = matchDirective(line, "@snippet-file-end") orelse return false;
    for (rest) |c| {
        if (!common.isWhitespace(c)) return false;
    }
    return true;
}

fn matchImportLine(line: []const u8) ?[]const u8 {
    const rest = matchDirective(line, "@import") orelse return null;
    var i: usize = 0;
    var saw_space = false;
    while (i < rest.len and common.isWhitespace(rest[i])) : (i += 1) {
        saw_space = true;
    }
    if (!saw_space) return null;
    if (i >= rest.len) return null;
    const name = trimEndWhitespace(rest[i..]);
    if (name.len == 0) return null;
    return name;
}

fn parseSnippetFiles(source: []const u8) !ParseResult {
    var main_builder = std.ArrayList(u8).empty;
    var files = std.ArrayList(FileEntry).empty;
    var file_indices = std.StringHashMap(usize).init(allocator);
    var current_file_index: ?usize = null;
    var current_builder = std.ArrayList(u8).empty;
    var has_file_blocks = false;

    var it = std.mem.splitScalar(u8, source, '\n');
    while (it.next()) |line_raw| {
        var line = line_raw;
        if (line.len > 0 and line[line.len - 1] == '\r') {
            line = line[0 .. line.len - 1];
        }

        if (current_file_index == null) {
            if (matchFileStart(line)) |name| {
                has_file_blocks = true;
                if (name.len == 0) {
                    continue;
                }
                var idx: usize = undefined;
                if (file_indices.get(name)) |existing| {
                    idx = existing;
                } else {
                    idx = files.items.len;
                    try file_indices.put(name, idx);
                    try files.append(allocator, FileEntry{ .name = name, .content = &[_]u8{} });
                }
                current_file_index = idx;
                current_builder = std.ArrayList(u8).empty;
                continue;
            }
            try appendLine(&main_builder, line);
            continue;
        }

        if (isFileEnd(line)) {
            const idx = current_file_index.?;
            const content = try finalizeBuilder(&current_builder);
            if (files.items[idx].content.len > 0) {
                allocator.free(files.items[idx].content);
            }
            files.items[idx].content = content;
            current_file_index = null;
            continue;
        }

        try appendLine(&current_builder, line);
    }

    if (current_file_index != null) {
        const idx = current_file_index.?;
        const content = try finalizeBuilder(&current_builder);
        if (files.items[idx].content.len > 0) {
            allocator.free(files.items[idx].content);
        }
        files.items[idx].content = content;
    }

    const main_source = try finalizeBuilder(&main_builder);

    return .{
        .main_source = main_source,
        .files = files,
        .file_indices = file_indices,
        .has_file_blocks = has_file_blocks,
    };
}

const ExpandContext = struct {
    expanded: std.ArrayList(u8),
    segments: std.ArrayList(LineMapSegment),
    expanded_line: u32,
};

fn appendExpandedLine(
    ctx: *ExpandContext,
    file_index: u32,
    original_line: u32,
    line: []const u8,
) !void {
    if (ctx.expanded.items.len > 0) {
        try ctx.expanded.append(allocator, '\n');
    }
    try ctx.expanded.appendSlice(allocator, line);

    if (ctx.segments.items.len > 0) {
        const last_index = ctx.segments.items.len - 1;
        var last = &ctx.segments.items[last_index];
        const expected_expanded = last.expanded_start_line + last.line_count;
        const expected_original = last.original_start_line + last.line_count;
        if (last.file_index == file_index and expected_expanded == ctx.expanded_line and expected_original == original_line) {
            last.line_count += 1;
        } else {
            try ctx.segments.append(allocator, LineMapSegment{
                .file_index = file_index,
                .expanded_start_line = ctx.expanded_line,
                .original_start_line = original_line,
                .line_count = 1,
            });
        }
    } else {
        try ctx.segments.append(allocator, LineMapSegment{
            .file_index = file_index,
            .expanded_start_line = ctx.expanded_line,
            .original_start_line = original_line,
            .line_count = 1,
        });
    }

    ctx.expanded_line += 1;
}

fn stackContains(stack: []const usize, value: usize) bool {
    for (stack) |entry| {
        if (entry == value) return true;
    }
    return false;
}

fn expandFile(
    file_index: u32,
    source: []const u8,
    ctx: *ExpandContext,
    files: []const FileEntry,
    file_indices: *std.StringHashMap(usize),
    stack: *std.ArrayList(usize),
    depth: usize,
) !void {
    var local_file_index: ?usize = null;
    if (file_index > 0) {
        const idx = @as(usize, file_index - 1);
        local_file_index = idx;
        try stack.append(allocator, idx);
    }
    defer if (local_file_index != null) {
        _ = stack.pop();
    };

    var line_number: u32 = 1;
    var it = std.mem.splitScalar(u8, source, '\n');
    while (it.next()) |line_raw| {
        var line = line_raw;
        if (line.len > 0 and line[line.len - 1] == '\r') {
            line = line[0 .. line.len - 1];
        }

        if (matchImportLine(line)) |import_name| {
            if (depth < MAX_IMPORT_DEPTH) {
                if (file_indices.get(import_name)) |target_idx| {
                    if (!stackContains(stack.items, target_idx)) {
                        const target_file_index: u32 = @intCast(target_idx + 1);
                        const target_source = files[target_idx].content;
                        try expandFile(
                            target_file_index,
                            target_source,
                            ctx,
                            files,
                            file_indices,
                            stack,
                            depth + 1,
                        );
                        line_number += 1;
                        continue;
                    }
                }
            }
        }

        try appendExpandedLine(ctx, file_index, line_number, line);
        line_number += 1;
    }
}

fn countLines(source: []const u8) u32 {
    if (source.len == 0) return 0;
    var count: u32 = 1;
    for (source) |c| {
        if (c == '\n') count += 1;
    }
    return count;
}

fn trimSegments(segments: *std.ArrayList(LineMapSegment), line_count: u32) void {
    if (line_count == 0) {
        segments.items.len = 0;
        return;
    }

    var i: usize = 0;
    while (i < segments.items.len) : (i += 1) {
        const seg = segments.items[i];
        if (seg.expanded_start_line > line_count) {
            segments.items.len = i;
            return;
        }
        const seg_end = seg.expanded_start_line + seg.line_count - 1;
        if (seg_end > line_count) {
            segments.items[i].line_count = line_count - seg.expanded_start_line + 1;
            segments.items.len = i + 1;
            return;
        }
    }
}

fn finalizeExpanded(ctx: *ExpandContext) ![]u8 {
    var end = ctx.expanded.items.len;
    while (end > 0 and common.isWhitespace(ctx.expanded.items[end - 1])) {
        end -= 1;
    }
    ctx.expanded.items.len = end;
    const line_count = countLines(ctx.expanded.items);
    trimSegments(&ctx.segments, line_count);
    return ctx.expanded.toOwnedSlice(allocator);
}

fn appendU32(out: *std.ArrayList(u8), value: u32) !void {
    var buf: [4]u8 = undefined;
    std.mem.writeInt(u32, &buf, value, .little);
    try out.appendSlice(allocator, &buf);
}

fn encodeScanResult(
    main_source: []const u8,
    files: []const FileEntry,
    expanded_source: []const u8,
    segments: []const LineMapSegment,
    has_file_blocks: bool,
) ![]u8 {
    var out = std.ArrayList(u8).empty;
    const flags: u32 = if (has_file_blocks) FLAG_HAS_FILE_BLOCKS else 0;

    try appendU32(&out, MAGIC);
    try appendU32(&out, VERSION);
    try appendU32(&out, flags);
    try appendU32(&out, @intCast(main_source.len));
    try appendU32(&out, @intCast(files.len));
    try appendU32(&out, @intCast(expanded_source.len));
    try appendU32(&out, @intCast(segments.len));
    try appendU32(&out, 0); // import count reserved

    try out.appendSlice(allocator, main_source);

    for (files) |entry| {
        try appendU32(&out, @intCast(entry.name.len));
        try appendU32(&out, @intCast(entry.content.len));
        try out.appendSlice(allocator, entry.name);
        try out.appendSlice(allocator, entry.content);
    }

    try out.appendSlice(allocator, expanded_source);

    for (segments) |segment| {
        try appendU32(&out, segment.file_index);
        try appendU32(&out, segment.expanded_start_line);
        try appendU32(&out, segment.original_start_line);
        try appendU32(&out, segment.line_count);
    }

    return out.toOwnedSlice(allocator);
}

pub fn scanSnippetFiles(source: []const u8) ![]u8 {
    var parsed = try parseSnippetFiles(source);
    defer {
        allocator.free(parsed.main_source);
        for (parsed.files.items) |entry| {
            if (entry.content.len > 0) {
                allocator.free(entry.content);
            }
        }
        parsed.files.deinit(allocator);
        parsed.file_indices.deinit();
    }

    var ctx = ExpandContext{
        .expanded = std.ArrayList(u8).empty,
        .segments = std.ArrayList(LineMapSegment).empty,
        .expanded_line = 1,
    };
    var stack = std.ArrayList(usize).empty;
    defer stack.deinit(allocator);

    try expandFile(0, parsed.main_source, &ctx, parsed.files.items, &parsed.file_indices, &stack, 0);

    const expanded_source = try finalizeExpanded(&ctx);
    defer allocator.free(expanded_source);

    const output = try encodeScanResult(
        parsed.main_source,
        parsed.files.items,
        expanded_source,
        ctx.segments.items,
        parsed.has_file_blocks,
    );

    ctx.segments.deinit(allocator);

    return output;
}
