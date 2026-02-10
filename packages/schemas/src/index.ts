import { z } from "zod";

export const CapabilitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url().optional()
});

export const EndpointSchema = z.object({
  path: z.string(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]).default("GET"),
  description: z.string().optional(),
  auth: z.enum(["none", "api_key", "oauth", "unknown"]).default("unknown")
});

export const PageSummarySchema = z.object({
  source: z.string(),
  title: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()).default([])
});

export const AgentJsonSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceType: z.enum(["url", "local", "mixed"]),
  homepage: z.string().url().optional(),
  docs: z.array(PageSummarySchema),
  capabilities: z.array(CapabilitySchema).default([]),
  endpoints: z.array(EndpointSchema).default([]),
  pricing: z.string().optional(),
  auth: z.string().optional(),
  generatedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.string()).default({})
});

export type AgentJson = z.infer<typeof AgentJsonSchema>;
export type PageSummary = z.infer<typeof PageSummarySchema>;
