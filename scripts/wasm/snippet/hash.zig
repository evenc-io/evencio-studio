/// Hash utilities for snippet source.

/// Returns a 32-bit FNV-1a hash of the input bytes.
pub fn hashBytes(source: []const u8) u32 {
    var hash: u32 = 2166136261;
    for (source) |c| {
        hash ^= c;
        hash *%= 16777619;
    }
    return hash;
}
