import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { isLibrary } from './services/library'

export interface AppConfig {
  recentLibraries: string[]
  lastOpened: string | null
}

const DEFAULT_CONFIG: AppConfig = { recentLibraries: [], lastOpened: null }

const configPath = (): string => join(app.getPath('userData'), 'config.json')

/** Read config, pruning any recent libraries whose folder no longer exists. */
export function getConfig(): AppConfig {
  let cfg: AppConfig = DEFAULT_CONFIG
  try {
    if (existsSync(configPath())) {
      cfg = { ...DEFAULT_CONFIG, ...(JSON.parse(readFileSync(configPath(), 'utf-8')) as AppConfig) }
    }
  } catch {
    cfg = { ...DEFAULT_CONFIG }
  }

  cfg.recentLibraries = (cfg.recentLibraries ?? []).filter(isLibrary)
  if (cfg.lastOpened && !isLibrary(cfg.lastOpened)) cfg.lastOpened = null
  return cfg
}

function save(cfg: AppConfig): void {
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf-8')
}

/** Add (or move to front) a library path in recents and mark it last-opened. */
export function addRecent(libPath: string): void {
  const cfg = getConfig()
  cfg.recentLibraries = [libPath, ...cfg.recentLibraries.filter((p) => p !== libPath)].slice(0, 20)
  cfg.lastOpened = libPath
  save(cfg)
}

export function removeRecent(libPath: string): void {
  const cfg = getConfig()
  cfg.recentLibraries = cfg.recentLibraries.filter((p) => p !== libPath)
  if (cfg.lastOpened === libPath) cfg.lastOpened = null
  save(cfg)
}

export function getRecentLibraries(): string[] {
  return getConfig().recentLibraries
}

export function getLastOpened(): string | null {
  return getConfig().lastOpened
}
