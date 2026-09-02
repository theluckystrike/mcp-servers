/** Workers has no home directory; every virtual path is rooted here. */
export function homedir(): string { return "/home/mcp"; }
export function tmpdir(): string { return "/tmp"; }
export default { homedir, tmpdir };
