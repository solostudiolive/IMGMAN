// Deterministic folder-icon tint by id (Eagle gives folders color). Shared by the sidebar tree and
// the inspector folder pills so a folder shows the same color everywhere, with no schema change.
const FOLDER_COLORS = ['#e0b341', '#4f9de0', '#5bbf7a', '#c96fd1', '#e07a5a', '#5ac6c6', '#c95b7a']

export function folderColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return FOLDER_COLORS[h % FOLDER_COLORS.length]
}
