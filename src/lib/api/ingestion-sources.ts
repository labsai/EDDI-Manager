import { api } from "@/lib/api-client";

export interface RagIngestionSource {
  resource?: string;
  name: string;
  description?: string;
  type: "web" | "file" | "git" | "api";
  sourceConfig: WebSourceConfig | FileSourceConfig | GitSourceConfig | ApiSourceConfig;
  ragConfigUri: string;
  ingestionSettings?: IngestionSettings;
  schedule?: Schedule;
}

export interface WebSourceConfig {
  startUrl: string;
  tocSelector?: string;
  scope?: Scope;
  crawlSettings?: CrawlSettings;
}

export interface Scope {
  sameDomainOnly?: boolean;
  pathPrefix?: string;
  maxDepth?: number;
  maxPages?: number;
  excludePatterns?: string[];
}

export interface CrawlSettings {
  requestDelayMs?: number;
  timeoutSeconds?: number;
  userAgent?: string;
}

export interface FileSourceConfig {
  basePath: string;
  globPattern: string;
  recursive: boolean;
  encoding?: string;
}

export interface GitSourceConfig {
  repoUrl: string;
  branch: string;
  path: string;
  accessTokenSecret?: string;
  filePattern?: string;
}

export interface ApiSourceConfig {
  endpointUrl: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  pagination?: PaginationConfig;
  dataPath?: string;
}

export interface PaginationConfig {
  type: "page" | "cursor" | "offset";
  pageParam?: string;
  limitParam?: string;
  limit?: number;
}

export interface IngestionSettings {
  chunkStrategy?: "recursive" | "paragraph" | "sentence";
  chunkSize?: number;
  chunkOverlap?: number;
  contentHashDedup?: boolean;
  maxContentLength?: number;
}

export interface Schedule {
  cronExpression?: string;
  enabled?: boolean;
}

const STORE = "ragstore";
const PLURAL = "ingestion-sources";

export function listIngestionSources(ragConfigUri: string): Promise<RagIngestionSource[]> {
  const params = new URLSearchParams({ ragConfigUri });
  return api.get<RagIngestionSource[]>(`/${STORE}/${PLURAL}/byRagConfig?${params}`);
}

export function getIngestionSource(id: string): Promise<RagIngestionSource> {
  return api.get<RagIngestionSource>(`/${STORE}/${PLURAL}/${id}`);
}

export function createIngestionSource(source: RagIngestionSource): Promise<{ location: string }> {
  return api.post<{ location: string }>(`/${STORE}/${PLURAL}`, source);
}

export function updateIngestionSource(
  id: string,
  version: number,
  source: RagIngestionSource,
): Promise<{ location: string }> {
  return api.put<{ location: string }>(`/${STORE}/${PLURAL}/${id}?version=${version}`, source);
}

export function deleteIngestionSource(id: string, version: number): Promise<void> {
  return api.delete(`/${STORE}/${PLURAL}/${id}?version=${version}`);
}

export function triggerIngestion(id: string, version: number): Promise<{ status: string }> {
  return api.post<{ status: string }>(`/${STORE}/${PLURAL}/${id}/trigger?version=${version}`);
}

export function parseUriId(uri: string): { id: string; version: number } | null {
  const match = uri.match(/\/([^/]+)\?version=(\d+)$/);
  if (!match) return null;
  return { id: match[1]!, version: parseInt(match[2]!, 10) };
}

export function parseUriVersion(uri: string): number {
  const match = uri.match(/version=(\d+)/);
  return match ? parseInt(match[1]!, 10) : 1;
}
