const std = @import("std");
const common = @import("common.zig");

const allocator = common.allocator;

/// Allowed module imports for snippet source.
const allowed_imports = [_][]const u8{ "react", "react/jsx-runtime" };
/// Import prefixes that are always blocked.
const banned_import_prefixes = [_][]const u8{
    "node:",
    "fs",
    "path",
    "child_process",
    "worker_threads",
    "os",
    "net",
    "tls",
    "http",
    "https",
    "dns",
    "bun",
    "process",
};
/// Disallowed direct calls.
const banned_callees = [_][]const u8{ "fetch", "eval", "Function", "setTimeout", "setInterval" };
/// Disallowed member calls.
const banned_member_callees = [_][]const u8{ "fetch", "sendBeacon", "postMessage" };
/// Disallowed constructors.
const banned_new = [_][]const u8{
    "Function",
    "WebSocket",
    "XMLHttpRequest",
    "EventSource",
    "Worker",
    "SharedWorker",
    "BroadcastChannel",
    "MessageChannel",
};
/// Disallowed globals and DOM access.
const banned_globals = [_][]const u8{
    "process",
    "Bun",
    "window",
    "globalThis",
    "self",
    "parent",
    "top",
    "document",
    "navigator",
    "location",
    "history",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "caches",
    "cookieStore",
};
/// Disallowed property access names.
const banned_properties = [_][]const u8{ "cookie" };

fn isInList(value: []const u8, list: []const []const u8) bool {
    for (list) |entry| {
        if (std.mem.eql(u8, value, entry)) return true;
    }
    return false;
}

fn isBannedImport(value: []const u8) bool {
    for (banned_import_prefixes) |prefix| {
        if (std.mem.eql(u8, value, prefix)) return true;
        if (value.len > prefix.len and std.mem.startsWith(u8, value, prefix) and value[prefix.len] == '/') {
            return true;
        }
    }
    return false;
}

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

/// Appends a security issue line in the "S\tline\tcol\tendLine\tendCol\tmessage" format.
fn appendIssue(
    out: *std.ArrayList(u8),
    line: u32,
    column: u32,
    endLine: u32,
    endColumn: u32,
    message: []const u8,
) !void {
    try out.appendSlice(allocator, "S\t");
    try common.appendNumber(out, line);
    try out.append(allocator, '\t');
    try common.appendNumber(out, column);
    try out.append(allocator, '\t');
    try common.appendNumber(out, endLine);
    try out.append(allocator, '\t');
    try common.appendNumber(out, endColumn);
    try out.append(allocator, '\t');
    try appendEscaped(out, message);
    try out.append(allocator, '\n');
}

/// Scans the snippet source for disallowed imports, globals, and calls.
/// Returns a newline-delimited protocol consumed by the JS bridge.
pub fn scanSecurityIssues(source: []const u8) ![]u8 {
    var out = std.ArrayList(u8).empty;
    var i: usize = 0;
    var line: u32 = 1;
    var column: u32 = 1;
    var prev_non_ws: u8 = 0;
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
                prev_non_ws = '`';
                continue;
            }
            if (c == '$' and i + 1 < source.len and source[i + 1] == '{') {
                common.advancePosition(c, &line, &column);
                common.advancePosition('{', &line, &column);
                i += 2;
                template_expr_depth = 1;
                prev_non_ws = '{';
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
                prev_non_ws = '{';
                continue;
            }
            if (c == '}') {
                common.advancePosition(c, &line, &column);
                i += 1;
                if (template_expr_depth > 0) template_expr_depth -= 1;
                if (template_expr_depth == 0) {
                    in_template = true;
                }
                prev_non_ws = '}';
                continue;
            }
        }

        if (c == '`') {
            in_template = true;
            template_expr_depth = 0;
            common.advancePosition(c, &line, &column);
            i += 1;
            prev_non_ws = '`';
            continue;
        }

        if (c == '\'' or c == '"') {
            const parsed = try common.parseStringLiteralValue(source, &i, &line, &column);
            allocator.free(parsed.value);
            prev_non_ws = c;
            continue;
        }

        if (common.isDigit(c)) {
            common.parseNumber(source, &i, &line, &column);
            prev_non_ws = '0';
            continue;
        }

        if (common.isIdentifierStart(c)) {
            const startLine = line;
            const startColumn = column;
            const name = common.parseIdentifier(source, &i, &line, &column);
            const endLine = line;
            const endColumn = if (column > 0) column - 1 else 1;
            const is_property = prev_non_ws == '.';

            if (std.mem.eql(u8, name, "import")) {
                var look_i = i;
                var look_line = line;
                var look_column = column;
                common.skipWhitespaceAndComments(source, &look_i, &look_line, &look_column);
                if (look_i < source.len and source[look_i] == '(') {
                    try appendIssue(&out, startLine, startColumn, endLine, endColumn, "Dynamic import() is not allowed in snippets");
                } else {
                    var probe_i = i;
                    var probe_line = line;
                    var probe_column = column;
                    var found_value: ?[]u8 = null;
                    while (probe_i < source.len) {
                        common.skipWhitespaceAndComments(source, &probe_i, &probe_line, &probe_column);
                        if (probe_i >= source.len) break;
                        const pc = source[probe_i];
                        if (pc == ';' or pc == '\n') break;
                        if (pc == '\'' or pc == '"') {
                            const parsed_import = try common.parseStringLiteralValue(source, &probe_i, &probe_line, &probe_column);
                            found_value = parsed_import.value;
                            break;
                        }
                        common.advancePosition(pc, &probe_line, &probe_column);
                        probe_i += 1;
                    }
                    if (found_value) |value| {
                        defer allocator.free(value);
                        if (isBannedImport(value)) {
                            const msg = try std.fmt.allocPrint(allocator, "Disallowed import: {s}", .{value});
                            defer allocator.free(msg);
                            try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg);
                        } else if (!isInList(value, allowed_imports[0..])) {
                            const msg = try std.fmt.allocPrint(allocator, "Only React imports are allowed. Found: {s}", .{value});
                            defer allocator.free(msg);
                            try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg);
                        }
                    }
                }
                prev_non_ws = name[name.len - 1];
                continue;
            }

            if (std.mem.eql(u8, name, "new")) {
                var look_i = i;
                var look_line = line;
                var look_column = column;
                common.skipWhitespaceAndComments(source, &look_i, &look_line, &look_column);
                if (look_i < source.len and common.isIdentifierStart(source[look_i])) {
                    var temp_i = look_i;
                    var temp_line = look_line;
                    var temp_column = look_column;
                    const target = common.parseIdentifier(source, &temp_i, &temp_line, &temp_column);
                    if (isInList(target, banned_new[0..])) {
                        const msg = try std.fmt.allocPrint(allocator, "Disallowed constructor: new {s}()", .{target});
                        defer allocator.free(msg);
                        try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg);
                    }
                    common.skipWhitespaceAndComments(source, &temp_i, &temp_line, &temp_column);
                    if (temp_i < source.len and source[temp_i] == '.') {
                        temp_i += 1;
                        temp_column += 1;
                        common.skipWhitespaceAndComments(source, &temp_i, &temp_line, &temp_column);
                        if (temp_i < source.len and common.isIdentifierStart(source[temp_i])) {
                            const member = common.parseIdentifier(source, &temp_i, &temp_line, &temp_column);
                            if (isInList(member, banned_new[0..])) {
                                const msg2 = try std.fmt.allocPrint(allocator, "Disallowed constructor: new {s}()", .{member});
                                defer allocator.free(msg2);
                                try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg2);
                            }
                        }
                    }
                }
                prev_non_ws = name[name.len - 1];
                continue;
            }

            if (!is_property and isInList(name, banned_callees[0..])) {
                var look_i2 = i;
                var look_line2 = line;
                var look_column2 = column;
                common.skipWhitespaceAndComments(source, &look_i2, &look_line2, &look_column2);
                if (look_i2 < source.len and source[look_i2] == '(') {
                    const msg3 = try std.fmt.allocPrint(allocator, "Disallowed call: {s}()", .{name});
                    defer allocator.free(msg3);
                    try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg3);
                }
            }

            if (std.mem.eql(u8, name, "require")) {
                var look_i3 = i;
                var look_line3 = line;
                var look_column3 = column;
                common.skipWhitespaceAndComments(source, &look_i3, &look_line3, &look_column3);
                if (look_i3 < source.len and source[look_i3] == '(') {
                    look_i3 += 1;
                    look_column3 += 1;
                    common.skipWhitespaceAndComments(source, &look_i3, &look_line3, &look_column3);
                    if (look_i3 < source.len and (source[look_i3] == '\'' or source[look_i3] == '"')) {
                        const parsed_req = try common.parseStringLiteralValue(source, &look_i3, &look_line3, &look_column3);
                        defer allocator.free(parsed_req.value);
                        if (!isInList(parsed_req.value, allowed_imports[0..])) {
                            try appendIssue(&out, startLine, startColumn, endLine, endColumn, "Only React require() calls are allowed");
                        }
                    } else {
                        try appendIssue(&out, startLine, startColumn, endLine, endColumn, "Only React require() calls are allowed");
                    }
                }
            }

            if (!is_property) {
                var look_i4 = i;
                var look_line4 = line;
                var look_column4 = column;
                common.skipWhitespaceAndComments(source, &look_i4, &look_line4, &look_column4);
                if (look_i4 < source.len and (source[look_i4] == '.' or source[look_i4] == '[')) {
                    if (isInList(name, banned_globals[0..])) {
                        const msg4 = try std.fmt.allocPrint(allocator, "Disallowed global access: {s}", .{name});
                        defer allocator.free(msg4);
                        try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg4);
                    }

                    if (source[look_i4] == '.') {
                        look_i4 += 1;
                        look_column4 += 1;
                        common.skipWhitespaceAndComments(source, &look_i4, &look_line4, &look_column4);
                        if (look_i4 < source.len and common.isIdentifierStart(source[look_i4])) {
                            const prop = common.parseIdentifier(source, &look_i4, &look_line4, &look_column4);
                            if (isInList(prop, banned_member_callees[0..])) {
                                var look_i5 = look_i4;
                                var look_line5 = look_line4;
                                var look_column5 = look_column4;
                                common.skipWhitespaceAndComments(source, &look_i5, &look_line5, &look_column5);
                                if (look_i5 < source.len and source[look_i5] == '(') {
                                    const msg5 = try std.fmt.allocPrint(allocator, "Disallowed call: {s}()", .{prop});
                                    defer allocator.free(msg5);
                                    try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg5);
                                }
                            }
                            if (isInList(prop, banned_properties[0..])) {
                                const msg6 = try std.fmt.allocPrint(allocator, "Disallowed property access: {s}", .{prop});
                                defer allocator.free(msg6);
                                try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg6);
                            }
                        }
                    } else if (source[look_i4] == '[') {
                        look_i4 += 1;
                        look_column4 += 1;
                        common.skipWhitespaceAndComments(source, &look_i4, &look_line4, &look_column4);
                        if (look_i4 < source.len and (source[look_i4] == '\'' or source[look_i4] == '"')) {
                            const parsed_prop = try common.parseStringLiteralValue(source, &look_i4, &look_line4, &look_column4);
                            defer allocator.free(parsed_prop.value);
                            if (isInList(parsed_prop.value, banned_member_callees[0..])) {
                                var look_i6 = look_i4;
                                var look_line6 = look_line4;
                                var look_column6 = look_column4;
                                common.skipWhitespaceAndComments(source, &look_i6, &look_line6, &look_column6);
                                if (look_i6 < source.len and source[look_i6] == '(') {
                                    const msg7 = try std.fmt.allocPrint(allocator, "Disallowed call: {s}()", .{parsed_prop.value});
                                    defer allocator.free(msg7);
                                    try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg7);
                                }
                            }
                            if (isInList(parsed_prop.value, banned_properties[0..])) {
                                const msg8 = try std.fmt.allocPrint(allocator, "Disallowed property access: {s}", .{parsed_prop.value});
                                defer allocator.free(msg8);
                                try appendIssue(&out, startLine, startColumn, endLine, endColumn, msg8);
                            }
                        }
                    }
                }
            }

            prev_non_ws = name[name.len - 1];
            continue;
        }

        common.advancePosition(c, &line, &column);
        i += 1;
        if (!common.isWhitespace(c)) {
            prev_non_ws = c;
        }
    }

    return out.toOwnedSlice(allocator);
}
