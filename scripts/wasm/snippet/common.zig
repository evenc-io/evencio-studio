const std = @import("std");

/// Shared allocator for snippet WASM helpers.
pub const allocator = std.heap.wasm_allocator;

/// Returns true for ASCII whitespace.
pub fn isWhitespace(c: u8) bool {
    return c == ' ' or c == '\n' or c == '\t' or c == '\r' or c == '\x0b' or c == '\x0c';
}

/// Returns true if the byte can start a JS identifier (ASCII subset).
pub fn isIdentifierStart(c: u8) bool {
    return (c >= 'A' and c <= 'Z') or (c >= 'a' and c <= 'z') or c == '_' or c == '$';
}

/// Returns true if the byte can appear in a JS identifier (ASCII subset).
pub fn isIdentifierChar(c: u8) bool {
    return isIdentifierStart(c) or (c >= '0' and c <= '9');
}

/// Returns true for ASCII digits.
pub fn isDigit(c: u8) bool {
    return c >= '0' and c <= '9';
}

/// Advances line/column counters for a single byte.
pub fn advancePosition(c: u8, line: *u32, column: *u32) void {
    if (c == '\n') {
        line.* += 1;
        column.* = 1;
    } else {
        column.* += 1;
    }
}

/// Advances line/column counters across a slice.
pub fn advanceRange(source: []const u8, start: usize, end: usize, line: *u32, column: *u32) void {
    var i = start;
    while (i < end) : (i += 1) {
        advancePosition(source[i], line, column);
    }
}

/// Skips a line comment and updates position.
pub fn skipLineComment(source: []const u8, idx: *usize, line: *u32, column: *u32) void {
    while (idx.* < source.len) {
        const c = source[idx.*];
        idx.* += 1;
        advancePosition(c, line, column);
        if (c == '\n') break;
    }
}

/// Skips a block comment and updates position.
pub fn skipBlockComment(source: []const u8, idx: *usize, line: *u32, column: *u32) void {
    while (idx.* + 1 < source.len) {
        const c = source[idx.*];
        const next = source[idx.* + 1];
        idx.* += 1;
        advancePosition(c, line, column);
        if (c == '*' and next == '/') {
            idx.* += 1;
            advancePosition(next, line, column);
            break;
        }
    }
}

/// Skips whitespace and comments, updating position.
pub fn skipWhitespaceAndComments(source: []const u8, idx: *usize, line: *u32, column: *u32) void {
    while (idx.* < source.len) {
        const c = source[idx.*];
        if (isWhitespace(c)) {
            idx.* += 1;
            advancePosition(c, line, column);
            continue;
        }
        if (c == '/' and idx.* + 1 < source.len) {
            const next = source[idx.* + 1];
            if (next == '/') {
                idx.* += 2;
                advancePosition('/', line, column);
                advancePosition('/', line, column);
                skipLineComment(source, idx, line, column);
                continue;
            }
            if (next == '*') {
                idx.* += 2;
                advancePosition('/', line, column);
                advancePosition('*', line, column);
                skipBlockComment(source, idx, line, column);
                continue;
            }
        }
        break;
    }
}

/// Parses an identifier and advances position. Returns a slice into the source.
pub fn parseIdentifier(source: []const u8, idx: *usize, line: *u32, column: *u32) []const u8 {
    const start = idx.*;
    while (idx.* < source.len and isIdentifierChar(source[idx.*])) {
        advancePosition(source[idx.*], line, column);
        idx.* += 1;
    }
    return source[start..idx.*];
}

/// Parses a numeric literal and advances position.
pub fn parseNumber(source: []const u8, idx: *usize, line: *u32, column: *u32) void {
    while (idx.* < source.len and (isDigit(source[idx.*]) or source[idx.*] == '.' or source[idx.*] == '_')) {
        advancePosition(source[idx.*], line, column);
        idx.* += 1;
    }
}

/// Reads a quoted literal into a newly allocated buffer.
/// `valid` is false for template literals that contain `${...}` expressions.
pub fn readQuotedLiteral(source: []const u8, start: usize, quote: u8) !struct {
    value: []u8,
    next: usize,
    valid: bool,
} {
    var list = std.ArrayList(u8).empty;
    var i = start + 1;
    var valid = true;

    while (i < source.len) : (i += 1) {
        const c = source[i];
        if (c == '\\') {
            if (i + 1 < source.len) {
                const next = source[i + 1];
                const mapped = switch (next) {
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    '\\' => '\\',
                    '\'' => '\'',
                    '"' => '"',
                    else => next,
                };
                try list.append(allocator, mapped);
                i += 1;
                continue;
            }
        }

        if (quote == '`' and c == '$' and i + 1 < source.len and source[i + 1] == '{') {
            valid = false;
        }

        if (c == quote) {
            return .{ .value = try list.toOwnedSlice(allocator), .next = i + 1, .valid = valid };
        }

        try list.append(allocator, c);
    }

    return .{ .value = try list.toOwnedSlice(allocator), .next = source.len, .valid = false };
}

/// Parses a string literal and returns its value plus source range.
pub fn parseStringLiteralValue(source: []const u8, idx: *usize, line: *u32, column: *u32) !struct {
    value: []u8,
    startLine: u32,
    startColumn: u32,
    endLine: u32,
    endColumn: u32,
    valid: bool,
} {
    const quote = source[idx.*];
    const startLine = line.*;
    const startColumn = column.*;
    const parsed = try readQuotedLiteral(source, idx.*, quote);
    const endIndex = parsed.next;
    advanceRange(source, idx.*, endIndex, line, column);
    idx.* = endIndex;
    return .{
        .value = parsed.value,
        .startLine = startLine,
        .startColumn = startColumn,
        .endLine = line.*,
        .endColumn = if (column.* > 0) column.* - 1 else 1,
        .valid = parsed.valid,
    };
}

/// Appends a decimal number to the output buffer.
pub fn appendNumber(out: *std.ArrayList(u8), value: u32) !void {
    var buf: [24]u8 = undefined;
    const slice = try std.fmt.bufPrint(&buf, "{}", .{value});
    try out.appendSlice(allocator, slice);
}
