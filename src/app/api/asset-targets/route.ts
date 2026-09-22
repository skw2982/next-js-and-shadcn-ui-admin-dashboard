import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "asset-master:v4:targets";

function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function checkPassword(req: Request) {
  const password = process.env.ASSET_APP_PASSWORD;

  if (!password || password.length < 24) {
    return reply(
      {
        error:
          "Vercel에 ASSET_APP_PASSWORD를 24자 이상으로 설정해주세요.",
      },
      503,
    );
  }

  const hash = (s: string) =>
    createHash("sha256").update(s).digest();

  const actual = req.headers.get("authorization") || "";

  return timingSafeEqual(
    hash(actual),
    hash(`Bearer ${password}`),
  )
    ? null
    : reply(
        { error: "저장 비밀번호가 맞지 않습니다." },
        401,
      );
}

function validPrices(value: unknown): Record<string, number> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("목표가 형식 오류");
  }

  const entries = Object.entries(value);

  if (entries.length > 500) {
    throw new Error("최대 500개까지 저장할 수 있습니다.");
  }

  const result: Record<string, number> = Object.create(null);

  for (const [key, price] of entries) {
    if (
      !key ||
      key.length > 240 ||
      ["__proto__", "constructor", "prototype"].includes(key) ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 1e12
    ) {
      throw new Error(
        "목표가는 0 이상 1조 이하 숫자로 입력해주세요.",
      );
    }

    result[key] = price;
  }

  return result;
}

async function redis(command: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Vercel의 Upstash 환경변수 두 개를 확인해주세요.",
    );
  }

  if (new URL(url).protocol !== "https:") {
    throw new Error(
      "Upstash URL은 https://로 시작해야 합니다.",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });

    if (!res.ok) {
      throw new Error(
        "저장소 연결 실패: Upstash URL과 새 토큰을 확인해주세요.",
      );
    }

    const data = await res.json();

    if (data.error) {
      throw new Error("저장소에서 오류가 발생했습니다.");
    }

    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const denied = checkPassword(req);
  if (denied) return denied;

  try {
    const raw = await redis(["GET", KEY]);

    if (raw == null) {
      return reply({ version: 0, prices: {} });
    }

    const data =
      typeof raw === "string" ? JSON.parse(raw) : raw;

    if (
      !Number.isSafeInteger(data.version) ||
      data.version < 1
    ) {
      throw new Error("저장 데이터 버전 오류");
    }

    return reply({
      version: data.version,
      prices: validPrices(data.prices),
    });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof Error && e.name !== "AbortError"
            ? e.message
            : "저장소 응답 시간이 초과되었습니다.",
      },
      502,
    );
  }
}

export async function PUT(req: Request) {
  const denied = checkPassword(req);
  if (denied) return denied;

  let version: number;
  let prices: Record<string, number>;

  try {
    const reader = req.body?.getReader();

    if (!reader) {
      throw new Error("저장할 내용이 없습니다.");
    }

    const chunks: Uint8Array[] = [];
    let size = 0;

    while (true) {
      const part = await reader.read();
      if (part.done) break;

      size += part.value.length;

      if (size > 100000) {
        await reader.cancel();
        return reply(
          { error: "저장 데이터가 너무 큽니다." },
          413,
        );
      }

      chunks.push(part.value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    const data = JSON.parse(
      new TextDecoder().decode(bytes),
    );

    version = data.version;

    if (
      !Number.isSafeInteger(version) ||
      version < 0 ||
      version >= Number.MAX_SAFE_INTEGER
    ) {
      throw new Error("저장 버전 오류");
    }

    prices = validPrices(data.prices);
  } catch (e) {
    return reply(
      {
        error:
          e instanceof Error ? e.message : "입력 형식 오류",
      },
      400,
    );
  }

  try {
    const next = {
      version: version + 1,
      prices,
    };

    const script = `
      local old = redis.call('GET', KEYS[1])
      local version = 0

      if old then
        version = cjson.decode(old).version
      end

      if version ~= tonumber(ARGV[1]) then
        return 0
      end

      redis.call('SET', KEYS[1], ARGV[2])
      return 1
    `;

    const result = await redis([
      "EVAL",
      script,
      1,
      KEY,
      version,
      JSON.stringify(next),
    ]);

    if (result !== 1) {
      return reply(
        {
          error:
            "다른 기기에서 수정했거나 이전 저장이 완료되었습니다. 입력값을 기록한 뒤 '저장값 불러오기'로 확인해주세요.",
        },
        409,
      );
    }

    return reply(next);
  } catch {
    return reply(
      {
        error:
          "저장 완료를 확인하지 못했습니다. 입력은 유지됩니다. 다시 저장하거나 저장값을 불러와 확인해주세요.",
      },
      502,
    );
  }
}
