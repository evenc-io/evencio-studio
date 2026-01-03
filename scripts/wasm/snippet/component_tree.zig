const std = @import("std");
const common = @import("common.zig");

const allocator = common.allocator;

const TagInfo = struct {
    kind: u8,
    name: []const u8,
    className: []u8,
    classOwned: bool,
    endIndex: usize,
    endLine: u32,
    endColumn: u32,
};

fn appendEscaped(out: *std.ArrayList(u8), value: []const u8) !void {
    for (value) |c| {
        switch (c) {
            '\\' => try out.appendSlice(allocator, "\\\\"),
            '\n' => try out.appendSlice(allocator, "\\n"),
            '\r' => try out.appendSlice(allocator, "\\r"),
            '\t' => try out.appendSlice(allocator, "\\t"),
            else => try out.append(allocator, c),
        }
    }
}

fn appendSigned(out: *std.ArrayList(u8), value: i32) !void {
    if (value < 0) {
        try out.append(allocator, '-');
        try common.appendNumber(out, @intCast(@as(i64, value) * -1));
    } else {
        try common.appendNumber(out, @intCast(value));
    }
}

fn looksLikeTagStart(source: []const u8, idx: usize) bool {
    if (idx + 1 >= source.len) return false;
    const next = source[idx + 1];
    return next == '/' or next == '>' or common.isIdentifierStart(next);
}

fn skipWhitespace(source: []const u8, idx: *usize, line: *u32, column: *u32) void {
    while (idx.* < source.len) {
        const c = source[idx.*];
        if (!common.isWhitespace(c)) break;
        idx.* += 1;
        common.advancePosition(c, line, column);
    }
}

fn parseAttributeName(source: []const u8, idx: *usize, line: *u32, column: *u32) []const u8 {
    const start = idx.*;
    while (idx.* < source.len) {
        const c = source[idx.*];
        if (common.isIdentifierChar(c) or c == '-' or c == ':') {
            common.advancePosition(c, line, column);
            idx.* += 1;
            continue;
        }
        break;
    }
    return source[start..idx.*];
}

fn parseClassValue(
    source: []const u8,
    idx: *usize,
    line: *u32,
    column: *u32,
) !?struct { value: []u8, owned: bool } {
    if (idx.* >= source.len) return null;
    const c = source[idx.*];
    if (c == '\'' or c == '"' or c == '`') {
        const parsed = try common.parseStringLiteralValue(source, idx, line, column);
        if (!parsed.valid) {
            allocator.free(parsed.value);
            return null;
        }
        return .{ .value = parsed.value, .owned = true };
    }
    if (c == '{') {
        common.advancePosition(c, line, column);
        idx.* += 1;
        skipWhitespace(source, idx, line, column);
        if (idx.* >= source.len) return null;
        const next = source[idx.*];
        if (next == '\'' or next == '"' or next == '`') {
            const parsed = try common.parseStringLiteralValue(source, idx, line, column);
            const value = parsed.value;
            if (!parsed.valid) {
                allocator.free(value);
                return null;
            }
            skipWhitespace(source, idx, line, column);
            if (idx.* < source.len and source[idx.*] == '}') {
                common.advancePosition('}', line, column);
                idx.* += 1;
                return .{ .value = value, .owned = true };
            }
            allocator.free(value);
            return null;
        }
        return null;
    }
    return null;
}

fn parseTag(source: []const u8, idx: usize, line: u32, column: u32) !?TagInfo {
    var i = idx + 1;
    var line_pos = line;
    var col_pos = column + 1;
    if (i >= source.len) return null;

    var isClosing = false;
    if (source[i] == '/') {
        isClosing = true;
        common.advancePosition(source[i], &line_pos, &col_pos);
        i += 1;
    }

    if (i < source.len and source[i] == '>') {
        common.advancePosition(source[i], &line_pos, &col_pos);
        i += 1;
        return TagInfo{
            .kind = if (isClosing) 2 else 3,
            .name = "",
            .className = &[_]u8{},
            .classOwned = false,
            .endIndex = i,
            .endLine = line_pos,
            .endColumn = if (col_pos > 0) col_pos - 1 else 1,
        };
    }

    if (i >= source.len) return null;
    if (!common.isIdentifierStart(source[i])) return null;
    const name_start = i;
    while (i < source.len) {
        const c = source[i];
        if (common.isIdentifierChar(c) or c == '.' or c == ':') {
            common.advancePosition(c, &line_pos, &col_pos);
            i += 1;
            continue;
        }
        break;
    }
    const name = source[name_start..i];

    if (isClosing) {
        while (i < source.len) {
            const c = source[i];
            if (c == '>') {
                common.advancePosition(c, &line_pos, &col_pos);
                i += 1;
                return TagInfo{
                    .kind = 2,
                    .name = name,
                    .className = &[_]u8{},
                    .classOwned = false,
                    .endIndex = i,
                    .endLine = line_pos,
                    .endColumn = if (col_pos > 0) col_pos - 1 else 1,
                };
            }
            common.advancePosition(c, &line_pos, &col_pos);
            i += 1;
        }
        return null;
    }

    var className: []u8 = &[_]u8{};
    var classOwned = false;
    var brace_depth: usize = 0;
    var quote: u8 = 0;

    while (i < source.len) {
        const c = source[i];
        if (quote != 0) {
            if (c == '\\' and i + 1 < source.len) {
                common.advancePosition(c, &line_pos, &col_pos);
                common.advancePosition(source[i + 1], &line_pos, &col_pos);
                i += 2;
                continue;
            }
            if (c == quote) {
                quote = 0;
            }
            common.advancePosition(c, &line_pos, &col_pos);
            i += 1;
            continue;
        }

        if (c == '\'' or c == '"' or c == '`') {
            quote = c;
            common.advancePosition(c, &line_pos, &col_pos);
            i += 1;
            continue;
        }

        if (c == '{') {
            brace_depth += 1;
            common.advancePosition(c, &line_pos, &col_pos);
            i += 1;
            continue;
        }
        if (c == '}' and brace_depth > 0) {
            brace_depth -= 1;
            common.advancePosition(c, &line_pos, &col_pos);
            i += 1;
            continue;
        }

        if (brace_depth == 0 and c == '/' and i + 1 < source.len and source[i + 1] == '>') {
            common.advancePosition(c, &line_pos, &col_pos);
            common.advancePosition('>', &line_pos, &col_pos);
            i += 2;
            return TagInfo{
                .kind = 1,
                .name = name,
                .className = className,
                .classOwned = classOwned,
                .endIndex = i,
                .endLine = line_pos,
                .endColumn = if (col_pos > 0) col_pos - 1 else 1,
            };
        }

        if (brace_depth == 0 and c == '>') {
            common.advancePosition(c, &line_pos, &col_pos);
            i += 1;
            return TagInfo{
                .kind = 3,
                .name = name,
                .className = className,
                .classOwned = classOwned,
                .endIndex = i,
                .endLine = line_pos,
                .endColumn = if (col_pos > 0) col_pos - 1 else 1,
            };
        }

        if (brace_depth == 0 and common.isIdentifierStart(c)) {
            const attr_name = parseAttributeName(source, &i, &line_pos, &col_pos);
            if (attr_name.len > 0 and (std.mem.eql(u8, attr_name, "className") or std.mem.eql(u8, attr_name, "class"))) {
                var look_i = i;
                var look_line = line_pos;
                var look_col = col_pos;
                skipWhitespace(source, &look_i, &look_line, &look_col);
                if (look_i < source.len and source[look_i] == '=') {
                    common.advancePosition('=', &look_line, &look_col);
                    look_i += 1;
                    skipWhitespace(source, &look_i, &look_line, &look_col);
                    if (try parseClassValue(source, &look_i, &look_line, &look_col)) |value| {
                        if (className.len == 0) {
                            className = value.value;
                            classOwned = value.owned;
                        } else if (value.owned) {
                            allocator.free(value.value);
                        }
                        i = look_i;
                        line_pos = look_line;
                        col_pos = look_col;
                        continue;
                    }
                }
                continue;
            }
            continue;
        }

        common.advancePosition(c, &line_pos, &col_pos);
        i += 1;
    }

    return null;
}

fn appendNode(
    out: *std.ArrayList(u8),
    id: u32,
    parentId: i32,
    startLine: u32,
    startColumn: u32,
    kind: u8,
    name: []const u8,
    className: []const u8,
) !void {
    try out.appendSlice(allocator, "N\t");
    try common.appendNumber(out, id);
    try out.append(allocator, '\t');
    try appendSigned(out, parentId);
    try out.append(allocator, '\t');
    try common.appendNumber(out, startLine);
    try out.append(allocator, '\t');
    try common.appendNumber(out, startColumn);
    try out.append(allocator, '\t');
    if (kind == 1) {
        try out.appendSlice(allocator, "fragment");
    } else {
        try out.appendSlice(allocator, "element");
    }
    try out.append(allocator, '\t');
    if (name.len > 0) {
        try appendEscaped(out, name);
    }
    try out.append(allocator, '\t');
    if (className.len > 0) {
        try appendEscaped(out, className);
    }
    try out.append(allocator, '\n');
}

/// Scans JSX tags and emits a tree of element/fragment nodes.
/// Output format:
///   N\tid\tparentId\tstartLine\tstartColumn\tkind\tname\tclassName
pub fn scanComponentTree(source: []const u8) ![]u8 {
    var out = std.ArrayList(u8).empty;
    var stack = std.ArrayList(u32).empty;
    defer stack.deinit(allocator);

    var next_id: u32 = 0;
    var i: usize = 0;
    var line: u32 = 1;
    var column: u32 = 1;
    var exprEnded = false;
    var jsxExprDepth: usize = 0;
    var in_template = false;
    var template_expr_depth: usize = 0;

    while (i < source.len) {
        if (in_template and template_expr_depth == 0) {
            const c = source[i];
            if (c == '\\') {
                if (i + 1 < source.len) {
                    common.advancePosition(source[i], &line, &column);
                    common.advancePosition(source[i + 1], &line, &column);
                    i += 2;
                    continue;
                }
            }
            if (c == '`') {
                common.advancePosition(c, &line, &column);
                i += 1;
                in_template = false;
                exprEnded = true;
                continue;
            }
            if (c == '$' and i + 1 < source.len and source[i + 1] == '{') {
                common.advancePosition(c, &line, &column);
                common.advancePosition('{', &line, &column);
                i += 2;
                template_expr_depth = 1;
                exprEnded = false;
                continue;
            }
            common.advancePosition(c, &line, &column);
            i += 1;
            continue;
        }

        common.skipWhitespaceAndComments(source, &i, &line, &column);
        if (i >= source.len) break;

        const c = source[i];

        if (in_template and template_expr_depth > 0) {
            if (c == '{') {
                common.advancePosition(c, &line, &column);
                i += 1;
                template_expr_depth += 1;
                exprEnded = false;
                continue;
            }
            if (c == '}') {
                common.advancePosition(c, &line, &column);
                i += 1;
                if (template_expr_depth > 0) template_expr_depth -= 1;
                if (template_expr_depth == 0) {
                    in_template = true;
                    exprEnded = true;
                }
                continue;
            }
        }

        if (stack.items.len > 0 and jsxExprDepth == 0) {
            if (c == '<' and looksLikeTagStart(source, i)) {
                const tagStartLine = line;
                const tagStartColumn = column;
                if (try parseTag(source, i, line, column)) |tag| {
                    i = tag.endIndex;
                    line = tag.endLine;
                    column = tag.endColumn + 1;

                    if (tag.kind == 2) {
                        if (stack.items.len > 0) {
                            _ = stack.pop();
                        }
                    } else {
                        const parentId: i32 = if (stack.items.len > 0) @intCast(stack.items[stack.items.len - 1]) else -1;
                        const nodeId = next_id;
                        next_id += 1;
                        const columnZero = if (tagStartColumn > 0) tagStartColumn - 1 else 0;
                        const isFragment = tag.name.len == 0;
                        try appendNode(&out, nodeId, parentId, tagStartLine, columnZero, if (isFragment) 1 else 0, tag.name, tag.className);
                        if (tag.kind != 1) {
                            try stack.append(allocator, nodeId);
                        }
                    }

                    if (tag.classOwned) {
                        allocator.free(tag.className);
                    }

                    exprEnded = true;
                    continue;
                }
            }

            if (c == '{') {
                common.advancePosition('{', &line, &column);
                i += 1;
                jsxExprDepth = 1;
                exprEnded = false;
                continue;
            }

            common.advancePosition(c, &line, &column);
            i += 1;
            continue;
        }

        if (jsxExprDepth > 0) {
            if (c == '{') {
                common.advancePosition(c, &line, &column);
                i += 1;
                jsxExprDepth += 1;
                exprEnded = false;
                continue;
            }
            if (c == '}') {
                common.advancePosition(c, &line, &column);
                i += 1;
                if (jsxExprDepth > 0) jsxExprDepth -= 1;
                exprEnded = true;
                continue;
            }
        }

        if (c == '<' and looksLikeTagStart(source, i) and (!exprEnded or stack.items.len > 0)) {
            const tagStartLine2 = line;
            const tagStartColumn2 = column;
            if (try parseTag(source, i, line, column)) |tag| {
                i = tag.endIndex;
                line = tag.endLine;
                column = tag.endColumn + 1;

                if (tag.kind == 2) {
                    if (stack.items.len > 0) {
                        _ = stack.pop();
                    }
                } else {
                    const parentId2: i32 = if (stack.items.len > 0) @intCast(stack.items[stack.items.len - 1]) else -1;
                    const nodeId2 = next_id;
                    next_id += 1;
                    const columnZero2 = if (tagStartColumn2 > 0) tagStartColumn2 - 1 else 0;
                    const isFragment2 = tag.name.len == 0;
                    try appendNode(&out, nodeId2, parentId2, tagStartLine2, columnZero2, if (isFragment2) 1 else 0, tag.name, tag.className);
                    if (tag.kind != 1) {
                        try stack.append(allocator, nodeId2);
                    }
                }

                if (tag.classOwned) {
                    allocator.free(tag.className);
                }

                exprEnded = true;
                continue;
            }
        }

        if (c == '`') {
            in_template = true;
            template_expr_depth = 0;
            common.advancePosition(c, &line, &column);
            i += 1;
            exprEnded = true;
            continue;
        }

        if (c == '\'' or c == '"') {
            const parsed = try common.parseStringLiteralValue(source, &i, &line, &column);
            allocator.free(parsed.value);
            exprEnded = true;
            continue;
        }

        if (common.isDigit(c)) {
            common.parseNumber(source, &i, &line, &column);
            exprEnded = true;
            continue;
        }

        if (common.isIdentifierStart(c)) {
            const name = common.parseIdentifier(source, &i, &line, &column);
            if (std.mem.eql(u8, name, "return")) {
                exprEnded = false;
            } else {
                exprEnded = true;
            }
            continue;
        }

        if (c == ')' or c == ']' or c == '}') {
            exprEnded = true;
        } else {
            exprEnded = false;
        }

        common.advancePosition(c, &line, &column);
        i += 1;
    }

    return out.toOwnedSlice(allocator);
}
