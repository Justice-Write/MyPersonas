export type ResearchArticle = {
  doi: string; title: string; authors: string[]; publication: string;
  published: string | null; date_precision: "day" | "month" | "year" | "unknown";
  source_url: string; source: "crossref"; retrieved_at: string;
};
const text = (v: unknown, max: number) => typeof v === "string"
  ? v.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
export function researchQuery(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 3 || value.length > 160)
    throw new Error("Enter a public research topic between 3 and 160 characters.");
  return value.trim();
}
export function crossrefUrl(query: unknown, days: unknown, now = new Date()): URL {
  if (![30, 90, 365, 1825].includes(Number(days))) throw new Error("Choose a supported publication window.");
  const since = new Date(now.getTime() - Number(days) * 86400000);
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", researchQuery(query));
  url.searchParams.set("filter", `from-pub-date:${since.toISOString().slice(0,10)},until-pub-date:${now.toISOString().slice(0,10)},type:journal-article`);
  url.searchParams.set("rows", "20");
  url.searchParams.set("select", "DOI,title,author,container-title,published");
  return url;
}
export function normalizeCrossref(payload: unknown, now = new Date()): ResearchArticle[] {
  const items = (payload as { message?: { items?: unknown } })?.message?.items;
  if (!Array.isArray(items)) throw new Error("The research source returned an unexpected response.");
  const result: ResearchArticle[] = [], seen = new Set<string>();
  for (const item of items.slice(0,20)) {
    if (!item || typeof item !== "object") continue;
    const doi = text(item.DOI, 250).toLowerCase(), title = text(item.title?.[0], 600);
    if (!/^10\.\d{4,9}\/[^\s<>]+$/.test(doi) || !title || seen.has(doi)) continue;
    seen.add(doi);
    const date = item.published?.["date-parts"]?.[0];
    let published: string | null = null, precision: ResearchArticle["date_precision"] = "unknown";
    if (Array.isArray(date) && date.length >= 1 && date.length <= 3 && date.every(Number.isInteger)) {
      const [y,m=1,d=1] = date;
      const candidate = new Date(Date.UTC(y,m-1,d));
      if (y >= 1600 && y <= now.getUTCFullYear() && candidate.getUTCFullYear()===y && candidate.getUTCMonth()===m-1 && candidate.getUTCDate()===d) {
        published=candidate.toISOString().slice(0,10); precision=(["year","month","day"] as const)[date.length-1];
      }
    }
    result.push({doi,title,authors:(Array.isArray(item.author)?item.author:[]).slice(0,12).map((a: Record<string,unknown>)=>text(`${text(a?.given,80)} ${text(a?.family,80)}`,170)).filter(Boolean),publication:text(item["container-title"]?.[0],200),published,date_precision:precision,source_url:"https://doi.org/"+doi.split("/").map(encodeURIComponent).join("/"),source:"crossref",retrieved_at:now.toISOString()});
  }
  return result;
}
export async function collectResearch(query: unknown, days: unknown, fetcher: typeof fetch = fetch): Promise<ResearchArticle[]> {
  const response=await fetcher(crossrefUrl(query,days),{redirect:"error",signal:AbortSignal.timeout(20000),headers:{Accept:"application/json","User-Agent":"MyPersonas-Research/1.0 (https://mypersonas.online)"}});
  if (!response.ok) throw new Error(response.status===429?"The research source is busy. Try again later.":"The research source is unavailable. Try again later.");
  if (!response.body) throw new Error("The research source returned no data.");
  const reader=response.body.getReader(); const chunks: Uint8Array[]=[];let total=0;
  try { for (;;) {const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>512000)throw new Error("The research response exceeded its size limit.");chunks.push(value);} }
  finally { await reader.cancel(); }
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return normalizeCrossref(JSON.parse(new TextDecoder().decode(bytes)));
}
