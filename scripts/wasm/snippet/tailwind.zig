const std = @import("std");
const common = @import("common.zig");

const allocator = common.allocator;

/// Returns true if the byte can start a JSX tag token.
fn isTagStartChar(c: u8) bool {
    return (c >= 'A' and c <= 'Z') or (c >= 'a' and c <= 'z') or c == '/' or c == '!';
}

/// Returns true if the byte is a boundary around attribute names.
fn isBoundaryChar(c: u8) bool {
    return common.isWhitespace(c) or c == '<' or c == '>' or c == '/' or c == '=';
}

fn addCandidates(map: *std.StringHashMap(void), value: []const u8) !void {
    var start: usize = 0;
    var i: usize = 0;
    while (i <= value.len) : (i += 1) {
        if (i == value.len or common.isWhitespace(value[i])) {
            if (i > start) {
                const token = value[start..i];
                if (!map.contains(token)) {
                    const copy = try allocator.dupe(u8, token);
                    try map.put(copy, {});
                }
            }
            start = i + 1;
        }
    }
}

/// Parses a simple `{ "foo" + "bar" }` expression for className concatenation.
/// Returns null if the expression contains non-literal values.
fn parseStaticExpression(source: []const u8, start_index: *usize) !?[]u8 {
    var i = start_index.* + 1;
    var depth: usize = 1;
    var expect_value = true;
    var valid = true;
    var builder = std.ArrayList(u8).empty;

    while (i < source.len) : (i += 1) {
        const c = source[i];
        if (c == '{') {
            depth += 1;
            valid = false;
            continue;
        }
        if (c == '}') {
            depth -= 1;
            if (depth == 0) {
                i += 1;
                break;
            }
            continue;
        }
        if (depth != 1) continue;
        if (common.isWhitespace(c)) continue;

        if (expect_value) {
            if (c == '\'' or c == '"' or c == '`') {
                const parsed = try common.readQuotedLiteral(source, i, c);
                i = parsed.next - 1;
                if (!parsed.valid) {
                    valid = false;
                    continue;
                }
                try builder.appendSlice(allocator, parsed.value);
                allocator.free(parsed.value);
                expect_value = false;
                continue;
            }
            valid = false;
            continue;
        }

        if (c == '+') {
            expect_value = true;
            continue;
        }

        valid = false;
    }

    start_index.* = i;
    if (!valid) {
        builder.deinit(allocator);
        return null;
    }

    return try builder.toOwnedSlice(allocator);
}

fn scanCandidates(source: []const u8) ![]u8 {
    var map = std.StringHashMap(void).init(allocator);
    defer {
        var it = map.iterator();
        while (it.next()) |entry| {
            allocator.free(entry.key_ptr.*);
        }
        map.deinit();
    }

    var i: usize = 0;
    var in_tag = false;
    var in_line_comment = false;
    var in_block_comment = false;

    while (i < source.len) {
        const c = source[i];

        if (in_line_comment) {
            if (c == '\n') {
                in_line_comment = false;
            }
            i += 1;
            continue;
        }

        if (in_block_comment) {
            if (c == '*' and i + 1 < source.len and source[i + 1] == '/') {
                in_block_comment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }

        if (!in_tag) {
            if (c == '/' and i + 1 < source.len and source[i + 1] == '/') {
                in_line_comment = true;
                i += 2;
                continue;
            }
            if (c == '/' and i + 1 < source.len and source[i + 1] == '*') {
                in_block_comment = true;
                i += 2;
                continue;
            }
            if (c == '<' and i + 1 < source.len and isTagStartChar(source[i + 1])) {
                in_tag = true;
                i += 1;
                continue;
            }
            i += 1;
            continue;
        }

        if (c == '>') {
            in_tag = false;
            i += 1;
            continue;
        }
        if (c == '/' and i + 1 < source.len and source[i + 1] == '>') {
            in_tag = false;
            i += 2;
            continue;
        }

        const token_classname = "className";
        const token_class = "class";

        var matched_len: usize = 0;
        if (i + token_classname.len <= source.len and std.mem.eql(u8, source[i..i + token_classname.len], token_classname)) {
            matched_len = token_classname.len;
        } else if (i + token_class.len <= source.len and std.mem.eql(u8, source[i..i + token_class.len], token_class)) {
            matched_len = token_class.len;
        }

        if (matched_len > 0) {
            if (i > 0 and !isBoundaryChar(source[i - 1])) {
                i += 1;
                continue;
            }
            if (i + matched_len < source.len and !isBoundaryChar(source[i + matched_len])) {
                i += 1;
                continue;
            }

            i += matched_len;
            while (i < source.len and common.isWhitespace(source[i])) : (i += 1) {}
            if (i >= source.len or source[i] != '=') {
                continue;
            }
            i += 1;
            while (i < source.len and common.isWhitespace(source[i])) : (i += 1) {}
            if (i >= source.len) continue;

            if (source[i] == '\'' or source[i] == '"' or source[i] == '`') {
                const parsed = try common.readQuotedLiteral(source, i, source[i]);
                i = parsed.next;
                if (parsed.valid) {
                    try addCandidates(&map, parsed.value);
                }
                allocator.free(parsed.value);
                continue;
            }

            if (source[i] == '{') {
                var expr_index = i;
                const expr = try parseStaticExpression(source, &expr_index);
                i = expr_index;
                if (expr) |value| {
                    defer allocator.free(value);
                    try addCandidates(&map, value);
                }
                continue;
            }
        }

        if (c == '\'' or c == '"' or c == '`') {
            const parsed = try common.readQuotedLiteral(source, i, c);
            i = parsed.next;
            allocator.free(parsed.value);
            continue;
        }

        i += 1;
    }

    var keys = std.ArrayList([]const u8).empty;
    defer keys.deinit(allocator);
    var it = map.iterator();
    while (it.next()) |entry| {
        try keys.append(allocator, entry.key_ptr.*);
    }

    if (keys.items.len == 0) {
        return @constCast(&[_]u8{});
    }

    std.sort.heap([]const u8, keys.items, {}, struct {
        fn lessThan(_: void, a: []const u8, b: []const u8) bool {
            return std.mem.lessThan(u8, a, b);
        }
    }.lessThan);

    var out = std.ArrayList(u8).empty;
    for (keys.items, 0..) |key, idx| {
        if (idx > 0) {
            try out.append(allocator, '\n');
        }
        try out.appendSlice(allocator, key);
    }

    return out.toOwnedSlice(allocator);
}

/// Scans JSX for Tailwind class candidates and returns a newline-delimited list.
pub fn scanTailwindCandidates(source: []const u8) ![]u8 {
    return scanCandidates(source);
}
