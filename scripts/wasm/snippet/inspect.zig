const std = @import("std");
const common = @import("common.zig");

const allocator = common.allocator;

const TextRange = struct {
    startLine: u32,
    startColumn: u32,
    endLine: u32,
    endColumn: u32,
};

const ElementBuild = struct {
    startLine: u32,
    startColumn: u32,
    elementType: u8,
    name: []const u8,
    textRanges: std.ArrayList(TextRange),
};

fn appendInspectElement(
    out: *std.ArrayList(u8),
    entry: *ElementBuild,
    endLine: u32,
    endColumn: u32,
) !void {
    try out.appendSlice(allocator, "E\t");
    try common.appendNumber(out, entry.startLine);
    try out.append(allocator, '\t');
    try common.appendNumber(out, entry.startColumn);
    try out.append(allocator, '\t');
    try common.appendNumber(out, endLine);
    try out.append(allocator, '\t');
    try common.appendNumber(out, endColumn);
    try out.append(allocator, '\t');
    if (entry.elementType == 1) {
        try out.appendSlice(allocator, "fragment");
    } else {
        try out.appendSlice(allocator, "element");
    }
    try out.append(allocator, '\t');
    if (entry.elementType == 0 and entry.name.len > 0) {
        try out.appendSlice(allocator, entry.name);
    }
    try out.append(allocator, '\t');
    try common.appendNumber(out, @as(u32, @intCast(entry.textRanges.items.len)));
    try out.append(allocator, '\n');

    for (entry.textRanges.items) |range| {
        try out.appendSlice(allocator, "T\t");
        try common.appendNumber(out, range.startLine);
        try out.append(allocator, '\t');
        try common.appendNumber(out, range.startColumn);
        try out.append(allocator, '\t');
        try common.appendNumber(out, range.endLine);
        try out.append(allocator, '\t');
        try common.appendNumber(out, range.endColumn);
        try out.append(allocator, '\n');
    }
}

fn looksLikeTagStart(source: []const u8, idx: usize) bool {
    if (idx + 1 >= source.len) return false;
    const next = source[idx + 1];
    return next == '/' or next == '>' or common.isIdentifierStart(next);
}

const TagInfo = struct {
    kind: u8,
    name: []const u8,
    endIndex: usize,
    endLine: u32,
    endColumn: u32,
};

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
            .kind = if (isClosing) 2 else 0,
            .name = "",
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
                .kind = if (isClosing) 2 else 1,
                .name = name,
                .endIndex = i,
                .endLine = line_pos,
                .endColumn = if (col_pos > 0) col_pos - 1 else 1,
            };
        }

        if (brace_depth == 0 and c == '>') {
            common.advancePosition(c, &line_pos, &col_pos);
            i += 1;
            return TagInfo{
                .kind = if (isClosing) 2 else 3,
                .name = name,
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

/// Builds an inspect index for JSX elements and text ranges.
/// Output format:
///   E\tstartLine\tstartCol\tendLine\tendCol\telement|fragment\tname\ttextCount
///   T\tstartLine\tstartCol\tendLine\tendCol
pub fn scanInspectIndex(source: []const u8) ![]u8 {
    var out = std.ArrayList(u8).empty;
    var stack = std.ArrayList(ElementBuild).empty;
    defer {
        for (stack.items) |*entry| {
            entry.textRanges.deinit(allocator);
        }
        stack.deinit(allocator);
    }

    var i: usize = 0;
    var line: u32 = 1;
    var column: u32 = 1;
    var exprEnded = false;
    var jsxExprDepth: usize = 0;
    var textActive = false;
    var textHasNonWs = false;
    var textStartLine: u32 = 1;
    var textStartColumn: u32 = 1;
    var textEndLine: u32 = 1;
    var textEndColumn: u32 = 1;
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
                if (textActive and textHasNonWs and stack.items.len > 0) {
                    stack.items[stack.items.len - 1].textRanges.append(allocator, .{
                        .startLine = textStartLine,
                        .startColumn = textStartColumn,
                        .endLine = textEndLine,
                        .endColumn = textEndColumn,
                    }) catch {};
                }
                textActive = false;
                textHasNonWs = false;

                const tagStartLine = line;
                const tagStartColumn = column;
                if (try parseTag(source, i, line, column)) |tag| {
                    i = tag.endIndex;
                    line = tag.endLine;
                    column = tag.endColumn + 1;

                    if (tag.kind == 2) {
                        if (stack.items.len > 0) {
                            const popped = stack.pop().?;
                            var entry = popped;
                            try appendInspectElement(&out, &entry, tag.endLine, tag.endColumn);
                            entry.textRanges.deinit(allocator);
                        }
                    } else {
                        const isFragment = tag.name.len == 0;
                        var entry = ElementBuild{
                            .startLine = tagStartLine,
                            .startColumn = tagStartColumn,
                            .elementType = if (isFragment) 1 else 0,
                            .name = tag.name,
                            .textRanges = std.ArrayList(TextRange).empty,
                        };
                        if (tag.kind == 1) {
                            try appendInspectElement(&out, &entry, tag.endLine, tag.endColumn);
                            entry.textRanges.deinit(allocator);
                        } else {
                            try stack.append(allocator, entry);
                        }
                    }

                    exprEnded = true;
                    continue;
                }
            }

            if (c == '{') {
                if (textActive and textHasNonWs and stack.items.len > 0) {
                    stack.items[stack.items.len - 1].textRanges.append(allocator, .{
                        .startLine = textStartLine,
                        .startColumn = textStartColumn,
                        .endLine = textEndLine,
                        .endColumn = textEndColumn,
                    }) catch {};
                }
                textActive = false;
                textHasNonWs = false;

                var look_i = i + 1;
                var look_line = line;
                var look_column = column + 1;
                common.skipWhitespaceAndComments(source, &look_i, &look_line, &look_column);
                if (look_i < source.len and (source[look_i] == '\'' or source[look_i] == '"')) {
                    const parsed = try common.parseStringLiteralValue(source, &look_i, &look_line, &look_column);
                    const stringStartLine = parsed.startLine;
                    const stringStartColumn = parsed.startColumn;
                    const stringEndLine = parsed.endLine;
                    const stringEndColumn = parsed.endColumn;
                    common.skipWhitespaceAndComments(source, &look_i, &look_line, &look_column);
                    if (look_i < source.len and source[look_i] == '}') {
                        if (stack.items.len > 0 and parsed.valid) {
                            stack.items[stack.items.len - 1].textRanges.append(allocator, .{
                                .startLine = stringStartLine,
                                .startColumn = stringStartColumn,
                                .endLine = stringEndLine,
                                .endColumn = stringEndColumn,
                            }) catch {};
                        }
                        allocator.free(parsed.value);
                        common.advancePosition('{', &line, &column);
                        i += 1;
                        common.advanceRange(source, i, look_i + 1, &line, &column);
                        i = look_i + 1;
                        continue;
                    }
                    allocator.free(parsed.value);
                }

                common.advancePosition('{', &line, &column);
                i += 1;
                jsxExprDepth = 1;
                exprEnded = false;
                continue;
            }

            if (!textActive) {
                textActive = true;
                textHasNonWs = false;
                textStartLine = line;
                textStartColumn = column;
            }
            if (!common.isWhitespace(c)) {
                textHasNonWs = true;
            }
            textEndLine = line;
            textEndColumn = column;
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
                        const popped2 = stack.pop().?;
                        var entry = popped2;
                        try appendInspectElement(&out, &entry, tag.endLine, tag.endColumn);
                        entry.textRanges.deinit(allocator);
                    }
                } else {
                    const isFragment = tag.name.len == 0;
                    var entry2 = ElementBuild{
                        .startLine = tagStartLine2,
                        .startColumn = tagStartColumn2,
                        .elementType = if (isFragment) 1 else 0,
                        .name = tag.name,
                        .textRanges = std.ArrayList(TextRange).empty,
                    };
                    if (tag.kind == 1) {
                        try appendInspectElement(&out, &entry2, tag.endLine, tag.endColumn);
                        entry2.textRanges.deinit(allocator);
                    } else {
                        try stack.append(allocator, entry2);
                    }
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
            const parsed2 = try common.parseStringLiteralValue(source, &i, &line, &column);
            allocator.free(parsed2.value);
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

    if (textActive and textHasNonWs and stack.items.len > 0) {
        stack.items[stack.items.len - 1].textRanges.append(allocator, .{
            .startLine = textStartLine,
            .startColumn = textStartColumn,
            .endLine = textEndLine,
            .endColumn = textEndColumn,
        }) catch {};
    }

    while (stack.items.len > 0) {
        const popped3 = stack.pop().?;
        var entry = popped3;
        try appendInspectElement(&out, &entry, entry.startLine, entry.startColumn);
        entry.textRanges.deinit(allocator);
    }

    return out.toOwnedSlice(allocator);
}
