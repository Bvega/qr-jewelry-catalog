import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

export function loadVerifiedPlan() {
  const plan = JSON.parse(readFileSync(resolve(root, "migration/m07b3-catalog-plan.json"), "utf8"));
  const photos = new Map(plan.finds.map((find) => [
    find.public_id,
    new Blob([readFileSync(resolve(root, "content-intake/photos", find.photo.filename))], { type: find.photo.mime_type })
  ]));
  return { plan, photos };
}

function matches(row, filters) {
  return filters.every(([column, value]) => row[column] === value);
}

class Builder {
  constructor(owner, table) {
    this.owner = owner;
    this.table = table;
    this.action = "select";
    this.payload = null;
    this.filters = [];
  }

  select() {
    return this;
  }

  insert(payload) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column, value) {
    this.filters.push([column, value]);
    return this;
  }

  async single() {
    const result = await this.execute();
    if (result.error) return result;
    if (!result.data || Array.isArray(result.data) && result.data.length !== 1) return { data: null, error: new Error("single") };
    return { data: Array.isArray(result.data) ? result.data[0] : result.data, error: null };
  }

  async maybeSingle() {
    const result = await this.execute();
    if (result.error) return result;
    const data = Array.isArray(result.data) ? result.data[0] || null : result.data;
    return { data, error: null };
  }

  then(resolveResult, rejectResult) {
    return this.execute().then(resolveResult, rejectResult);
  }

  async execute() {
    const rows = this.owner.state[this.table];
    if (!rows) return { data: null, error: new Error("unknown table") };
    if (this.action === "select") return { data: rows.filter((row) => matches(row, this.filters)).map((row) => ({ ...row })), error: null };
    if (this.action === "insert") {
      this.owner.calls.writes += 1;
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = [];
      for (const payload of payloads) {
        if (this.owner.fail.metadata && this.table === "find_photos") return { data: null, error: new Error("metadata") };
        if (this.table === "collections" && rows.some((row) => row.id === payload.id)) return { data: null, error: new Error("duplicate") };
        if (this.table === "finds" && rows.some((row) => row.public_id === payload.public_id || row.slug === payload.slug)) return { data: null, error: new Error("duplicate") };
        const sequence = ++this.owner.sequence;
        const row = this.table === "finds"
          ? {
              id: `20000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
              published_at: null,
              ...payload,
              price_amount: String(payload.price_amount)
            }
          : this.table === "find_photos"
            ? { id: `30000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`, ...payload }
            : { ...payload };
        rows.push(row);
        inserted.push({ ...row });
      }
      if (this.table === "find_photos" && this.owner.fail.metadataAfterWriteError) {
        return { data: null, error: new Error("ambiguous metadata insert") };
      }
      return { data: inserted, error: null };
    }
    if (this.action === "delete") {
      this.owner.calls.writes += 1;
      if (this.table === "finds" && this.owner.fail.findDelete) return { data: null, error: new Error("delete") };
      if (this.table === "find_photos" && this.owner.fail.photoDelete) return { data: null, error: new Error("delete") };
      if (this.table === "finds" && this.owner.fail.findDeleteNoop) return { data: [], error: null };
      if (this.table === "find_photos" && this.owner.fail.photoDeleteNoop) return { data: [], error: null };
      const removedIds = new Set(rows.filter((row) => matches(row, this.filters)).map((row) => row.id));
      this.owner.state[this.table] = rows.filter((row) => !matches(row, this.filters));
      if (this.table === "finds") {
        this.owner.state.find_photos = this.owner.state.find_photos.filter((photo) => !removedIds.has(photo.find_id));
      }
      if (this.table === "finds" && this.owner.fail.findDeleteAfterWriteError) return { data: null, error: new Error("ambiguous delete") };
      if (this.table === "find_photos" && this.owner.fail.photoDeleteAfterWriteError) return { data: null, error: new Error("ambiguous delete") };
      return { data: [], error: null };
    }
    return { data: null, error: new Error("unsupported") };
  }
}

export function createMockClient({ role = "owner", collections = [], finds = [], photos = [], relations = [], objects = new Map(), fail = {} } = {}) {
  const owner = {
    state: {
      collections: collections.map((item) => ({ ...item })),
      finds: finds.map((item) => ({ ...item })),
      find_photos: photos.map((item) => ({ ...item })),
      find_relations: relations.map((item) => ({ ...item }))
    },
    objects: new Map(objects),
    calls: { writes: 0, uploads: 0, removes: 0 },
    fail,
    sequence: finds.length + photos.length
  };
  const client = {
    state: owner.state,
    objects: owner.objects,
    calls: owner.calls,
    rpc: async () => ({ data: role, error: null }),
    from: (table) => new Builder(owner, table),
    storage: {
      from: () => ({
        list: async (folder) => {
          if (fail.list) return { data: null, error: new Error("list") };
          const prefix = `${folder}/`;
          return {
            data: Array.from(owner.objects.keys())
              .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
              .map((path) => ({ name: path.slice(prefix.length) })),
            error: null
          };
        },
        download: async (path) => owner.objects.has(path)
          ? { data: owner.objects.get(path), error: null }
          : { data: null, error: new Error("missing") },
        upload: async (path, blob) => {
          owner.calls.writes += 1;
          owner.calls.uploads += 1;
          if (fail.upload || owner.objects.has(path)) return { data: null, error: new Error("upload") };
          owner.objects.set(path, blob);
          if (fail.uploadAfterWriteError) return { data: null, error: new Error("ambiguous upload") };
          return { data: { path }, error: null };
        },
        remove: async (paths) => {
          owner.calls.writes += 1;
          owner.calls.removes += 1;
          if (fail.remove) return { data: null, error: new Error("remove") };
          if (fail.removeNoop) return { data: [], error: null };
          for (const path of paths) owner.objects.delete(path);
          if (fail.removeAfterWriteError) return { data: null, error: new Error("ambiguous remove") };
          return { data: [], error: null };
        }
      })
    }
  };
  return client;
}

export function databaseFind(planned, id = "21000000-0000-4000-8000-000000000001") {
  return {
    id,
    public_id: planned.public_id,
    slug: planned.slug,
    legacy_id: null,
    title: planned.title,
    collection_id: planned.collection_id,
    price_amount: planned.price_amount,
    price_currency: "USD",
    availability: planned.availability,
    description: planned.description,
    condition: planned.condition,
    is_published: false,
    is_featured: false,
    sort_order: planned.sort_order,
    published_at: null,
    archived_at: null
  };
}

export function databasePhoto(planned, find) {
  return {
    id: "31000000-0000-4000-8000-000000000001",
    find_id: find.id,
    storage_path: `finds/${find.id}/${planned.photo.filename}`,
    role: "primary",
    sequence: 1,
    alt_text: planned.photo.alt_text,
    width: planned.photo.width,
    height: planned.photo.height
  };
}
