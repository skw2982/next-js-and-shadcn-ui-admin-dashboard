"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

// I열이 전일 종가이면 "previousClose"로 바꾸세요.
// I열이 주당 전일 대비 증감액이면 "change" 그대로 사용합니다.
const CONFIG: {
  dailyKind: "change" | "previousClose";
  overseasCash: "KRW" | "USD";
} = {
  dailyKind: "change",
  overseasCash: "USD",
};

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTtkGA-97rU-gqeH6rjf2loe8L1GoKOtqLayVYNftdkuatjh1_z-8xVj1EgYGRU3L5O_NAPjQDSVGlK/pub";

const GIDS = [
  "0",
  "817751922",
  "1398634207",
  "359303564",
  "380349145",
];

const API = "/api/asset-targets";

const TABS = [
  "통합 요약",
  "계좌별 주식",
  "실물 / 부채",
  "예적금",
  "실현 손익",
  "목표가 시뮬",
];

type Stock = {
  id: string;
  name: string;
  account: string;
  currency: string;
  cash: boolean;
  qty: number;
  avg: number;
  current: number;
  change: number;
};

type Asset = {
  name: string;
  value: number;
};

type Saving = {
  name: string;
  monthly: number;
  current: number;
  maturity: string;
  day: number;
  rate: number;
};

type Realized = {
  date: string;
  name: string;
  profit: number;
  note: string;
};

type Data = {
  stocks: Stock[];
  assets: Asset[];
  debts: Asset[];
  savings: Saving[];
  realized: Realized[];
  rate: number | null;
  rateDate: string;
  updated: string;
  warnings: string[];
};

type Saved = {
  version: number;
  prices: Record<string, number>;
};

const fmt = (n: number) =>
  n.toLocaleString("ko-KR", {
    maximumFractionDigits: 0,
  });

const dec = (n: number) =>
  n.toLocaleString("ko-KR", {
    maximumFractionDigits: 4,
  });

const sign = (n: number) =>
  `${n > 0 ? "+" : ""}${fmt(n)}`;

const tone = (n: number) =>
  n > 0 ? "up" : n < 0 ? "down" : "muted";

const time = (s: string) =>
  new Date(s).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });

const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function num(
  raw: string | undefined,
  label: string,
  optional = false,
) {
  let s = (raw || "").trim();

  if (!s && optional) return 0;

  if (/^\(.*\)$/.test(s)) {
    s = `-${s.slice(1, -1)}`;
  }

  s = s
    .replace(/[₩$,%\s원]/g, "")
    .replace(/−/g, "-");

  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) ||
    !Number.isFinite(Number(s))
  ) {
    throw new Error(
      `${label}: 숫자나 시트 수식 오류를 확인해주세요.`,
    );
  }

  return Number(s);
}

function date(raw: string) {
  const m = raw
    .trim()
    .match(
      /^(\d{4})[-/.]\s*(\d{1,2})[-/.]\s*(\d{1,2})\.?$/,
    );

  if (!m) {
    throw new Error(
      `날짜 형식 오류: ${raw || "빈칸"}`,
    );
  }

  const [, y, mo, d] = m;
  const v = new Date(
    Date.UTC(+y, +mo - 1, +d),
  );

  if (
    v.getUTCFullYear() !== +y ||
    v.getUTCMonth() !== +mo - 1 ||
    v.getUTCDate() !== +d
  ) {
    throw new Error(
      `존재하지 않는 날짜: ${raw}`,
    );
  }

  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function csv(
  text: string,
  columns: number,
  label: string,
) {
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      `${label}: 시트가 CSV로 반환되지 않았습니다.`,
    );
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
    closed = false;
  };

  const endRow = () => {
    endCell();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };

  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else {
        cell += c;
      }
    } else if (c === ",") {
      endCell();
    } else if (c === "\n" || c === "\r") {
      if (
        c === "\r" &&
        text[i + 1] === "\n"
      ) {
        i++;
      }

      endRow();
    } else if (
      c === '"' &&
      !cell.trim() &&
      !closed
    ) {
      quoted = true;
      cell = "";
    } else if (
      c === '"' ||
      (closed && c.trim())
    ) {
      throw new Error(
        `${label}: CSV 따옴표 형식 오류`,
      );
    } else {
      cell += c;
    }
  }

  if (quoted) {
    throw new Error(
      `${label}: CSV 따옴표가 닫히지 않았습니다.`,
    );
  }

  if (cell || row.length || closed) {
    endRow();
  }

  if (
    !rows.length ||
    rows[0].length < columns
  ) {
    throw new Error(
      `${label}: 첫 행의 헤더와 열 개수를 확인해주세요.`,
    );
  }

  return rows.slice(1).map((r, i) => {
    if (r.length < columns) {
      throw new Error(
        `${label} ${i + 2}행: 열이 부족합니다.`,
      );
    }

    return r;
  });
}

async function textRequest(
  url: string,
  init: RequestInit = {},
  parent?: AbortSignal,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, 12000);

  parent?.addEventListener("abort", abort, {
    once: true,
  });

  if (parent?.aborted) abort();

  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      let message = `통신 오류 (${res.status})`;

      try {
        message =
          JSON.parse(text).error || message;
      } catch {
        // 일반 HTTP 오류
      }

      throw new Error(message);
    }

    return text;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  }
}

function savingEstimate(
  s: Saving,
  startDate: string,
) {
  if (
    !s.maturity ||
    (s.monthly > 0 && !s.day)
  ) {
    return null;
  }

  const start = Date.parse(
    `${startDate}T00:00:00Z`,
  );

  const end = Date.parse(
    `${s.maturity}T00:00:00Z`,
  );

  if (end <= start) {
    return {
      total: s.current,
      count: 0,
      matured: true,
    };
  }

  let interest =
    s.current *
    (s.rate / 100) *
    ((end - start) / 86400000 / 365);

  let count = 0;
  const first = new Date(start);

  for (let i = 0; i < 1200; i++) {
    const month = new Date(
      Date.UTC(
        first.getUTCFullYear(),
        first.getUTCMonth() + i,
        1,
      ),
    );

    if (month.getTime() >= end) break;

    const last = new Date(
      Date.UTC(
        month.getUTCFullYear(),
        month.getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();

    const due = Date.UTC(
      month.getUTCFullYear(),
      month.getUTCMonth(),
      Math.min(s.day || 1, last),
    );

    if (
      s.monthly > 0 &&
      due > start &&
      due < end
    ) {
      count++;

      interest +=
        s.monthly *
        (s.rate / 100) *
        ((end - due) / 86400000 / 365);
    }
  }

  return {
    total:
      s.current +
      s.monthly * count +
      interest,
    count,
    matured: false,
  };
}

function Card({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="card">
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="stat">
      <small>{label}</small>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export default function AssetMaster() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [pass, setPass] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, string>
  >({});
  const [dirty, setDirty] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");

  const requestRef = useRef<AbortController | null>(
    null,
  );

  const cloudLock = useRef(false);

  const refresh = useCallback(async () => {
    if (requestRef.current) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);

    try {
      const filesPromise = Promise.all(
        GIDS.map((gid) =>
          textRequest(
            `${CSV_URL}?gid=${gid}&single=true&output=csv&t=${Date.now()}`,
            {},
            controller.signal,
          ),
        ),
      );

      const ratePromise = textRequest(
        "https://open.er-api.com/v6/latest/USD",
        {},
        controller.signal,
      )
        .then((t) => JSON.parse(t))
        .catch(() => null);

      const [
        [sText, rText, aText, dText, svText],
        fx,
      ] = await Promise.all([
        filesPromise,
        ratePromise,
      ]);

      const warnings: string[] = [];
      const stocks: Stock[] = [];

      for (const [i, c] of csv(
        sText,
        9,
        "주식",
      ).entries()) {
        const label = `주식 ${i + 2}행`;
        const qty = num(
          c[7],
          `${label} 수량`,
        );

        if (qty === 0) continue;

        if (
          qty < 0 ||
          !c[0] ||
          !c[1] ||
          !c[2]
        ) {
          throw new Error(
            `${label}: 시장·계좌·종목명·수량을 확인해주세요.`,
          );
        }

        const cash =
          /예수금|현금/.test(c[2]);

        const foreign =
          c[0].includes("해외");

        const currency =
          c[9]?.toUpperCase() ||
          (foreign
            ? cash
              ? CONFIG.overseasCash
              : "USD"
            : "KRW");

        if (
          !["KRW", "USD"].includes(currency)
        ) {
          throw new Error(
            `${label}: J열 통화는 KRW 또는 USD로 입력해주세요.`,
          );
        }

        if (cash && qty !== 1) {
          throw new Error(
            `${label}: 예수금은 수량 1, 현재가 칸에 잔액을 입력해주세요.`,
          );
        }

        if (
          cash &&
          foreign &&
          !c[9]
        ) {
          warnings.push(
            `해외 예수금은 ${CONFIG.overseasCash}로 가정합니다. J열에 실제 통화를 적어주세요.`,
          );
        }

        const current = num(
          c[6],
          `${label} 현재가`,
        );

        const avg = cash
          ? 0
          : num(c[5], `${label} 평단`);

        const daily = cash
          ? 0
          : num(c[8], `${label} I열`);

        if (
          current < 0 ||
          avg < 0 ||
          (CONFIG.dailyKind ===
            "previousClose" &&
            daily < 0)
        ) {
          throw new Error(
            `${label}: 가격은 음수일 수 없습니다.`,
          );
        }

        stocks.push({
          id: JSON.stringify([
            c[0],
            currency,
            c[3] || c[2],
          ]),
          account: c[1],
          name: c[2],
          currency,
          cash,
          qty,
          current,
          avg,
          change: cash
            ? 0
            : CONFIG.dailyKind ===
                "previousClose"
              ? current - daily
              : daily,
        });
      }

      const rate =
        fx?.result === "success" &&
        typeof fx.rates?.KRW === "number" &&
        Number.isFinite(fx.rates.KRW) &&
        fx.rates.KRW > 0
          ? fx.rates.KRW
          : null;

      if (
        !rate &&
        stocks.some(
          (s) => s.currency === "USD",
        )
      ) {
        throw new Error(
          "환율 조회 실패로 기존 데이터를 유지합니다. 다시 새로고침해주세요.",
        );
      }

      const assetRows = (
        text: string,
        label: string,
      ): Asset[] =>
        csv(text, 2, label).map((c, i) => {
          const value = num(
            c[1],
            `${label} ${i + 2}행`,
          );

          if (!c[0] || value < 0) {
            throw new Error(
              `${label}: 이름과 양수 금액을 입력해주세요.`,
            );
          }

          return {
            name: c[0],
            value,
          };
        });

      const realized = csv(
        rText,
        6,
        "실현손익",
      ).map((c, i) => {
        if (!c[1]) {
          throw new Error(
            `실현손익 ${i + 2}행: 종목명을 입력해주세요.`,
          );
        }

        return {
          date: date(c[0]),
          name: c[1],
          profit: num(
            c[3],
            `실현손익 ${i + 2}행`,
          ),
          note: c[5],
        };
      });

      const savings = csv(
        svText,
        6,
        "예적금",
      ).map((c, i): Saving => {
        const label = `예적금 ${i + 2}행`;

        const monthly = num(
          c[1],
          label,
          true,
        );

        const current = num(c[2], label);
        const day = num(c[4], label, true);
        const interest = num(
          c[5],
          label,
          true,
        );

        const maturity = c[3]
          ? date(c[3])
          : "";

        if (
          !c[0] ||
          monthly < 0 ||
          current < 0 ||
          !Number.isInteger(day) ||
          day < 0 ||
          day > 31 ||
          interest < 0 ||
          interest > 100 ||
          (maturity &&
            +maturity.slice(0, 4) >
              new Date().getFullYear() +
                99)
        ) {
          throw new Error(
            `${label}: 상품명·금액·이체일·만기·금리를 확인해주세요.`,
          );
        }

        return {
          name: c[0],
          monthly,
          current,
          day,
          rate: interest,
          maturity,
        };
      });

      const stamp =
        fx?.time_last_update_unix;

      const rateDate =
        rate &&
        typeof stamp === "number" &&
        Number.isFinite(stamp)
          ? new Date(
              stamp * 1000,
            ).toISOString()
          : "";

      if (
        rateDate &&
        Date.now() - Date.parse(rateDate) >
          72 * 3600000
      ) {
        warnings.push(
          "환율 기준일이 72시간 이상 지났습니다.",
        );
      }

      const next: Data = {
        stocks,
        realized,
        savings,
        assets: assetRows(
          aText,
          "실물자산",
        ),
        debts: assetRows(dText, "부채"),
        rate,
        rateDate,
        updated: new Date().toISOString(),
        warnings: [...new Set(warnings)],
      };

      if (!controller.signal.aborted) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof Error &&
            e.name !== "AbortError"
            ? e.message
            : "응답 시간이 초과되었습니다. 다시 시도해주세요.",
        );
      }
    } finally {
      if (
        requestRef.current === controller
      ) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();

    const timer = setInterval(() => {
      if (!document.hidden) {
        void refresh();
      }
    }, 60000);

    return () => {
      clearInterval(timer);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!dirty) return;

    const warn = (
      e: BeforeUnloadEvent,
    ) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener(
      "beforeunload",
      warn,
    );

    return () =>
      window.removeEventListener(
        "beforeunload",
        warn,
      );
  }, [dirty]);

  const parsed = useMemo(() => {
    const prices: Record<string, number> =
      Object.create(null);

    for (const [key, text] of Object.entries(
      drafts,
    )) {
      const s = text
        .replace(/,/g, "")
        .trim();

      if (!s) continue;

      if (
        !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(
          s,
        ) ||
        !Number.isFinite(Number(s)) ||
        Number(s) > 1e12
      ) {
        return {
          prices: saved?.prices || {},
          invalid: true,
        };
      }

      prices[key] = Number(s);
    }

    return {
      prices,
      invalid: false,
    };
  }, [drafts, saved]);

  async function cloud(save: boolean) {
    if (
      cloudLock.current ||
      !pass.trim() ||
      (save &&
        (!saved || parsed.invalid))
    ) {
      return;
    }

    if (
      !save &&
      dirty &&
      !window.confirm(
        "저장하지 않은 입력을 버리고 서버 저장값을 불러올까요?",
      )
    ) {
      return;
    }

    cloudLock.current = true;
    setCloudBusy(true);
    setCloudMessage(
      save
        ? "저장 중…"
        : "불러오는 중…",
    );

    try {
      const result: Saved = JSON.parse(
        await textRequest(API, {
          method: save ? "PUT" : "GET",
          headers: {
            Authorization: `Bearer ${pass.trim()}`,
            "Content-Type":
              "application/json",
          },
          ...(save
            ? {
                body: JSON.stringify({
                  version: saved!.version,
                  prices: parsed.prices,
                }),
              }
            : {}),
        }),
      );

      if (
        !Number.isSafeInteger(
          result.version,
        ) ||
        !result.prices ||
        typeof result.prices !== "object" ||
        Array.isArray(result.prices) ||
        Object.values(
          result.prices,
        ).some(
          (v) =>
            typeof v !== "number" ||
            !Number.isFinite(v) ||
            v < 0,
        )
      ) {
        throw new Error(
          "저장 데이터 형식 오류",
        );
      }

      setSaved(result);

      setDrafts(
        Object.fromEntries(
          Object.entries(
            result.prices,
          ).map(([k, v]) => [
            k,
            String(v),
          ]),
        ),
      );

      setDirty(false);

      setCloudMessage(
        save
          ? "목표가 저장 완료 ✓"
          : "저장된 목표가를 불러왔습니다.",
      );
    } catch (e) {
      setCloudMessage(
        e instanceof Error &&
          e.name !== "AbortError"
          ? e.message
          : "저장소 응답 시간이 초과되었습니다. 입력은 유지됩니다.",
      );
    } finally {
      cloudLock.current = false;
      setCloudBusy(false);
    }
  }

  const portfolio = useMemo(() => {
    const groups = new Map<
      string,
      {
        name: string;
        items: Stock[];
        total: number;
        cash: number;
        cost: number;
        profit: number;
        daily: number;
      }
    >();

    const combined = new Map<
      string,
      {
        id: string;
        name: string;
        currency: string;
        qty: number;
        value: number;
        cost: number;
        nativeValue: number;
        fx: number;
      }
    >();

    for (const s of data?.stocks || []) {
      const fx =
        s.currency === "USD"
          ? data!.rate!
          : 1;

      const value =
        s.current * s.qty * fx;

      const a = groups.get(s.account) || {
        name: s.account,
        items: [],
        total: 0,
        cash: 0,
        cost: 0,
        profit: 0,
        daily: 0,
      };

      a.items.push(s);
      a.total += value;

      if (s.cash) {
        a.cash += value;
      } else {
        a.cost += s.avg * s.qty * fx;

        a.profit +=
          (s.current - s.avg) *
          s.qty *
          fx;

        a.daily +=
          s.change * s.qty * fx;

        const b = combined.get(s.id) || {
          id: s.id,
          name: s.name,
          currency: s.currency,
          qty: 0,
          value: 0,
          cost: 0,
          nativeValue: 0,
          fx,
        };

        b.qty += s.qty;
        b.value += value;
        b.cost += s.avg * s.qty * fx;
        b.nativeValue +=
          s.current * s.qty;

        combined.set(s.id, b);
      }

      groups.set(s.account, a);
    }

    const accounts = [
      ...groups.values(),
    ];

    return {
      accounts,
      items: [...combined.values()],
      total: accounts.reduce(
        (n, a) => n + a.total,
        0,
      ),
      cash: accounts.reduce(
        (n, a) => n + a.cash,
        0,
      ),
      daily: accounts.reduce(
        (n, a) => n + a.daily,
        0,
      ),
    };
  }, [data]);

  const simulation = portfolio.items
    .map((s) => {
      const current =
        s.nativeValue / s.qty;

      const target =
        parsed.prices[s.id] ?? current;

      const targetValue =
        target * s.qty * s.fx;

      return {
        ...s,
        current,
        targetValue,
        extra: targetValue - s.value,
        profit: targetValue - s.cost,
      };
    })
    .sort((a, b) => b.value - a.value);

  const extra = simulation.reduce(
    (n, s) => n + s.extra,
    0,
  );

  const assets =
    data?.assets.reduce(
      (n, a) => n + a.value,
      0,
    ) || 0;

  const debts =
    data?.debts.reduce(
      (n, a) => n + a.value,
      0,
    ) || 0;

  const savings =
    data?.savings.reduce(
      (n, a) => n + a.current,
      0,
    ) || 0;

  const net =
    portfolio.total +
    assets +
    savings -
    debts;

  const realized = useMemo(() => {
    const years = new Map<
      string,
      number
    >();

    const months = new Map<
      string,
      {
        total: number;
        items: Realized[];
      }
    >();

    for (const r of [
      ...(data?.realized || []),
    ].sort((a, b) =>
      b.date.localeCompare(a.date),
    )) {
      const y = r.date.slice(0, 4);
      const m = r.date.slice(0, 7);

      years.set(
        y,
        (years.get(y) || 0) +
          r.profit,
      );

      const group = months.get(m) || {
        total: 0,
        items: [],
      };

      group.total += r.profit;
      group.items.push(r);
      months.set(m, group);
    }

    return {
      years: [...years],
      months: [...months],
      total: [...years.values()].reduce(
        (a, b) => a + b,
        0,
      ),
    };
  }, [data]);

  return (
    <main className="am4">
      <style>{CSS}</style>

      <div className="wrap">
        <header>
          <div>
            <p className="eyebrow">
              PERSONAL FINANCE
            </p>

            <h1>
              ASSET MASTER <span>V4</span>
            </h1>

            <small>
              {data
                ? `마지막 성공 조회 ${time(data.updated)}`
                : "자산과 목표를 한눈에"}
            </small>
          </div>

          <button
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading
              ? "동기화 중…"
              : "↻ 새로고침"}
          </button>
        </header>

        <nav>
          {TABS.map((name, i) => (
            <button
              key={name}
              className={
                tab === i ? "active" : ""
              }
              onClick={() => setTab(i)}
            >
              {i + 1}. {name}
            </button>
          ))}
        </nav>

        {error && (
          <p
            className="alert"
            role="alert"
          >
            {error}
            {data &&
              " 마지막 정상 데이터를 표시하고 있습니다."}
          </p>
        )}

        {!data ? (
          <Card>
            <p className="empty">
              {loading
                ? "구글시트와 환율을 불러오는 중입니다…"
                : "조회된 데이터가 없습니다. 설정 확인 후 새로고침해주세요."}
            </p>
          </Card>
        ) : (
          <>
            {data.warnings.map((w) => (
              <p
                className="alert"
                key={w}
              >
                {w}
              </p>
            ))}

            <p className="meta">
              USD/KRW{" "}
              {data.rate
                ? dec(data.rate)
                : "—"}
              {data.rateDate &&
                ` · 환율 기준 ${time(data.rateDate)}`}
              {" · 60초마다 확인"}
            </p>

            {tab === 0 && (
              <div className="stack">
                <section className="hero">
                  <p className="eyebrow">
                    CURRENT NET WORTH · 순자산
                  </p>

                  <h2>
                    {fmt(net)}{" "}
                    <small>원</small>
                  </h2>

                  <div className="row">
                    <p className="muted">
                      약{" "}
                      {(net / 1e8).toFixed(2)}
                      억원
                    </p>

                    <div>
                      <small>
                        보유 주식 전일 대비
                      </small>

                      <strong
                        className={tone(
                          portfolio.daily,
                        )}
                      >
                        {sign(portfolio.daily)}
                        원
                      </strong>
                    </div>
                  </div>
                </section>

                <div className="grid four">
                  <Stat
                    label="주식 평가액"
                    value={`${fmt(
                      portfolio.total -
                        portfolio.cash,
                    )}원`}
                  />

                  <Stat
                    label="예수금"
                    value={`${fmt(portfolio.cash)}원`}
                  />

                  <Stat
                    label="실물 자산"
                    value={`${fmt(assets)}원`}
                  />

                  <Stat
                    label="예적금"
                    value={`${fmt(savings)}원`}
                  />
                </div>

                <Card>
                  <div className="row">
                    <span>부채 총계</span>
                    <strong>
                      {fmt(debts)}원
                    </strong>
                  </div>
                </Card>

                <p className="note">
                  전일 대비는 현재 보유 수량과 현재
                  환율 기준입니다. 당일 매매·입출금·환율
                  변동 손익은 포함하지 않습니다.
                  해외 평단도 현재 환율로 환산하므로
                  증권사의 실제 원화 수익률과 차이가
                  있을 수 있습니다.
                </p>
              </div>
            )}

            {tab === 1 && (
              <div className="stack">
                {!portfolio.accounts.length && (
                  <p className="empty">
                    보유 내역이 없습니다.
                  </p>
                )}

                {portfolio.accounts.map((a) => (
                  <Card key={a.name}>
                    <div className="row">
                      <h2>💳 {a.name}</h2>

                      <div className="right">
                        <strong>
                          {fmt(a.total)}원
                        </strong>

                        <p
                          className={tone(a.profit)}
                        >
                          평가손익{" "}
                          {sign(a.profit)}원 ·{" "}
                          {a.cost > 0
                            ? `${(
                                (a.profit /
                                  a.cost) *
                                100
                              ).toFixed(2)}%`
                            : "—"}
                        </p>

                        <small
                          className={tone(a.daily)}
                        >
                          전일 대비{" "}
                          {sign(a.daily)}원
                        </small>
                      </div>
                    </div>

                    <div className="table">
                      <table>
                        <thead>
                          <tr>
                            <th>종목 / 수량</th>
                            <th>현재가 / 평단</th>
                            <th>평가액</th>
                            <th>
                              전일 대비 / 평가손익
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {a.items.map((s, i) => {
                            const fx =
                              s.currency ===
                              "USD"
                                ? data.rate!
                                : 1;

                            const profit =
                              (s.current -
                                s.avg) *
                              s.qty *
                              fx;

                            const daily =
                              s.change *
                              s.qty *
                              fx;

                            return (
                              <tr
                                key={`${s.id}-${i}`}
                              >
                                <td>
                                  <b>
                                    {s.cash
                                      ? "💵 "
                                      : ""}
                                    {s.name}
                                  </b>

                                  <small>
                                    {s.cash
                                      ? "예수금"
                                      : `${dec(s.qty)}주`}
                                    {" · "}
                                    {s.currency}
                                  </small>
                                </td>

                                <td>
                                  {dec(s.current)}

                                  {!s.cash && (
                                    <small>
                                      평단{" "}
                                      {dec(s.avg)}
                                    </small>
                                  )}
                                </td>

                                <td>
                                  {fmt(
                                    s.current *
                                      s.qty *
                                      fx,
                                  )}
                                  원
                                </td>

                                <td>
                                  {s.cash ? (
                                    "—"
                                  ) : (
                                    <>
                                      <b
                                        className={tone(
                                          daily,
                                        )}
                                      >
                                        {sign(daily)}
                                        원
                                      </b>

                                      <small
                                        className={tone(
                                          profit,
                                        )}
                                      >
                                        {sign(
                                          profit,
                                        )}
                                        원 (
                                        {s.avg > 0
                                          ? `${(
                                              (s.current /
                                                s.avg -
                                                1) *
                                              100
                                            ).toFixed(
                                              2,
                                            )}%`
                                          : "—"}
                                        )
                                      </small>
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {tab === 2 && (
              <div className="grid two">
                {[
                  {
                    name: "🏠 실물 자산",
                    items: data.assets,
                    debt: false,
                  },
                  {
                    name: "💳 부채",
                    items: data.debts,
                    debt: true,
                  },
                ].map((g) => (
                  <Card key={g.name}>
                    <h2>{g.name}</h2>

                    {!g.items.length && (
                      <p className="empty">
                        등록 내역이 없습니다.
                      </p>
                    )}

                    {g.items.map((a, i) => (
                      <div
                        className="list"
                        key={i}
                      >
                        <span>{a.name}</span>

                        <b>
                          {g.debt &&
                          a.value > 0
                            ? "−"
                            : ""}
                          {fmt(a.value)}원
                        </b>
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            )}

            {tab === 3 && (
              <div className="stack">
                <p className="note">
                  현재 잔액 + 앞으로 납입할 원금 +
                  오늘 이후 세전 단리 이자의
                  추정치입니다. 과거 발생
                  이자·세금·우대 조건은 제외합니다.
                  오늘 납입분은 잔액에 포함된 것으로
                  보고 만기일 당일 추가 납입은
                  제외합니다.
                </p>

                {!data.savings.length && (
                  <p className="empty">
                    등록된 예적금이 없습니다.
                  </p>
                )}

                {data.savings.map((s, i) => {
                  const estimate =
                    savingEstimate(
                      s,
                      today(),
                    );

                  return (
                    <Card key={i}>
                      <div className="row">
                        <h2>{s.name}</h2>

                        <small>
                          {s.maturity
                            ? `만기 ${s.maturity}`
                            : "만기일 미등록"}
                        </small>
                      </div>

                      <div className="grid four">
                        <Stat
                          label="현재 잔액"
                          value={`${fmt(s.current)}원`}
                        />

                        <Stat
                          label="월 납입액"
                          value={`${fmt(s.monthly)}원`}
                          sub={
                            s.day
                              ? `매월 ${s.day}일`
                              : "이체일 미등록"
                          }
                        />

                        <Stat
                          label="연 금리"
                          value={`${dec(s.rate)}%`}
                        />

                        <Stat
                          label={
                            estimate?.matured
                              ? "만기 경과 · 잔액 확인"
                              : "만기 단순 추정액"
                          }
                          value={
                            estimate
                              ? `${fmt(estimate.total)}원`
                              : "계산 대기"
                          }
                          sub={
                            estimate
                              ? `앞으로 ${estimate.count}회 납입`
                              : "만기일·이체일을 확인해주세요."
                          }
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {tab === 4 && (
              <div className="stack">
                <section className="hero">
                  <p className="eyebrow">
                    총 누적 실현손익
                  </p>

                  <h2
                    className={tone(
                      realized.total,
                    )}
                  >
                    {sign(realized.total)}{" "}
                    <small>원</small>
                  </h2>
                </section>

                <div className="grid four">
                  {realized.years.map(
                    ([y, profit]) => (
                      <Stat
                        key={y}
                        label={`${y}년 누계`}
                        value={`${sign(profit)}원`}
                      />
                    ),
                  )}
                </div>

                {!realized.months.length && (
                  <p className="empty">
                    실현손익 내역이 없습니다.
                  </p>
                )}

                {realized.months.map(
                  ([m, g]) => (
                    <Card key={m}>
                      <div className="row">
                        <h2>{m} 결산</h2>

                        <strong
                          className={tone(
                            g.total,
                          )}
                        >
                          {sign(g.total)}원
                        </strong>
                      </div>

                      <div className="table">
                        <table>
                          <thead>
                            <tr>
                              <th>날짜</th>
                              <th>종목</th>
                              <th>실현손익</th>
                            </tr>
                          </thead>

                          <tbody>
                            {g.items.map(
                              (r, i) => (
                                <tr key={i}>
                                  <td>
                                    {r.date}
                                  </td>

                                  <td>
                                    {r.name}

                                    {r.note && (
                                      <small className="memo">
                                        {r.note}
                                      </small>
                                    )}
                                  </td>

                                  <td
                                    className={tone(
                                      r.profit,
                                    )}
                                  >
                                    {sign(
                                      r.profit,
                                    )}
                                    원
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  ),
                )}
              </div>
            )}

            {tab === 5 && (
              <div className="stack">
                <Card>
                  <h2>목표가 저장</h2>

                  <p className="muted">
                    저장 비밀번호로 연결한 뒤
                    목표가를 수정하세요. 저장하면
                    컴퓨터와 휴대폰에서 같은 값을
                    불러올 수 있습니다.
                  </p>

                  <div className="cloud">
                    <input
                      aria-label="목표가 저장 비밀번호"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Vercel에 설정한 저장 비밀번호"
                      value={pass}
                      disabled={cloudBusy}
                      onChange={(e) =>
                        setPass(e.target.value)
                      }
                    />

                    <button
                      disabled={
                        cloudBusy ||
                        !pass.trim()
                      }
                      onClick={() =>
                        void cloud(false)
                      }
                    >
                      {saved
                        ? "저장값 불러오기"
                        : "저장소 연결"}
                    </button>

                    <button
                      className="active"
                      disabled={
                        cloudBusy ||
                        !saved ||
                        !dirty ||
                        parsed.invalid ||
                        !pass.trim()
                      }
                      onClick={() =>
                        void cloud(true)
                      }
                    >
                      목표가 저장
                    </button>
                  </div>

                  <p
                    className="meta"
                    role="status"
                  >
                    {cloudMessage}
                    {dirty &&
                      " · 저장하지 않은 변경 있음"}
                  </p>

                  {!saved && (
                    <small>
                      연결 전에는 현재가 기준으로
                      표시합니다. 저장 비밀번호는
                      이 탭을 닫으면 지워지지만
                      저장한 목표가는 남습니다.
                    </small>
                  )}

                  {parsed.invalid && (
                    <p className="alert">
                      목표가는 0 이상 1조 이하
                      숫자로 입력해주세요. 잘못된
                      입력 중에는 마지막 저장값
                      기준으로 계산합니다.
                    </p>
                  )}
                </Card>

                <div className="grid two">
                  <Stat
                    label="목표가 기준 주식 평가액 · 예수금 제외"
                    value={`${fmt(
                      simulation.reduce(
                        (n, s) =>
                          n + s.targetValue,
                        0,
                      ),
                    )}원`}
                    sub={`현재 대비 ${sign(extra)}원`}
                  />

                  <Stat
                    label="목표가 기준 전체 순자산"
                    value={`${fmt(net + extra)}원`}
                    sub="예수금·실물·예적금·부채·환율은 현재 값 고정"
                  />
                </div>

                <div className="grid two">
                  {simulation.map((s) => (
                    <Card key={s.id}>
                      <div className="row">
                        <div>
                          <h2>{s.name}</h2>

                          <small>
                            {dec(s.qty)}주 ·{" "}
                            {s.currency}
                          </small>

                          <p className="muted">
                            현재가{" "}
                            {dec(s.current)}
                          </p>
                        </div>

                        <label className="target">
                          목표가 ({s.currency})

                          <input
                            aria-label={`${s.name} 목표가`}
                            type="text"
                            inputMode="decimal"
                            placeholder={String(
                              s.current,
                            )}
                            value={
                              drafts[s.id] ?? ""
                            }
                            disabled={
                              !saved ||
                              cloudBusy
                            }
                            onChange={(e) => {
                              const value =
                                e.target.value;

                              setDrafts(
                                (prev) => ({
                                  ...prev,
                                  [s.id]: value,
                                }),
                              );

                              setDirty(true);
                            }}
                          />
                        </label>
                      </div>

                      <div className="list">
                        <span>
                          현재 대비 변동액
                        </span>

                        <b
                          className={tone(
                            s.extra,
                          )}
                        >
                          {sign(s.extra)}원
                        </b>
                      </div>

                      <div className="list">
                        <span>
                          매입원가 대비 손익
                        </span>

                        <b
                          className={tone(
                            s.profit,
                          )}
                        >
                          {sign(s.profit)}원

                          <small>
                            {s.cost > 0
                              ? `${(
                                  (s.profit /
                                    s.cost) *
                                  100
                                ).toFixed(2)}%`
                              : "수익률 —"}
                          </small>
                        </b>
                      </div>
                    </Card>
                  ))}
                </div>

                {!simulation.length && (
                  <p className="empty">
                    시뮬레이션할 주식이 없습니다.
                  </p>
                )}

                <p className="note">
                  빈 목표가는 현재가를 사용합니다.
                  같은 종목의 계좌별 현재가가
                  다르면 수량 가중 평균을
                  사용합니다. 매매·수수료·세금·환율
                  변화는 반영하지 않습니다.
                  실현손익은 순자산에 중복해서
                  더하지 않습니다.
                </p>
              </div>
            )}
          </>
        )}

        <footer>
          ASSET MASTER V4 · PERSONAL FINANCE
        </footer>
      </div>
    </main>
  );
}

const CSS = `
.am4 {
  min-height: 100vh;
  background:
    radial-gradient(
      ellipse at 15% 0%,
      #162b4c,
      transparent 45%
    ),
    #0c0e14;
  color: #e2e8f0;
  font: 14px/1.6 Arial, sans-serif;
  padding: 32px 20px;
  color-scheme: dark;
}

.am4 * {
  box-sizing: border-box;
}

.am4 .wrap {
  max-width: 1120px;
  margin: auto;
}

.am4 h1,
.am4 h2,
.am4 p {
  margin: 0;
}

.am4 h1 {
  font-size: clamp(26px, 4vw, 38px);
  font-weight: 900;
  letter-spacing: -1px;
}

.am4 h1 span {
  color: #60a5fa;
}

.am4 h2 {
  font-size: 19px;
  font-weight: 800;
}

.am4 strong {
  font-size: 22px;
  font-weight: 800;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.am4 small {
  display: block;
  font-size: 12px;
  color: #94a3b8;
}

.am4 button,
.am4 input {
  font: inherit;
}

.am4 button {
  border: 1px solid #334155;
  background: #192333;
  color: #dbeafe;
  padding: 10px 15px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
}

.am4 button:hover:not(:disabled) {
  background: #294262;
}

.am4 button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.am4 input {
  border: 1px solid #475569;
  background: #080e1a;
  color: white;
  padding: 11px;
  border-radius: 10px;
  min-width: 0;
  width: 100%;
}

.am4 button:focus-visible,
.am4 input:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 3px;
}

.am4 .active {
  background: #2563eb;
  border-color: #3b82f6;
  color: white;
}

.am4 header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  padding-bottom: 24px;
  border-bottom: 1px solid #253044;
}

.am4 .eyebrow {
  font-size: 11px;
  letter-spacing: 2px;
  color: #93c5fd;
  margin-bottom: 8px;
}

.am4 nav {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 24px 0;
}

.am4 nav button {
  white-space: nowrap;
}

.am4 .meta {
  font-size: 12px;
  color: #94a3b8;
  margin: 12px 0 18px;
}

.am4 .muted {
  color: #94a3b8;
  font-size: 13px;
}

.am4 .card,
.am4 .stat {
  background: #111a29eb;
  border: 1px solid #283449;
  border-radius: 22px;
  padding: 24px;
  min-width: 0;
}

.am4 .card h2 {
  margin-bottom: 12px;
}

.am4 .stat {
  padding: 18px;
}

.am4 .stat strong {
  display: block;
  margin: 6px 0;
  font-size: 20px;
}

.am4 .hero {
  background: linear-gradient(
    120deg,
    #153057,
    #141d2c 80%
  );
  border: 1px solid #315080;
  border-radius: 30px;
  padding: 36px;
}

.am4 .hero h2 {
  font-size: clamp(28px, 5vw, 60px);
  font-weight: 900;
  letter-spacing: -1.5px;
  overflow-wrap: anywhere;
}

.am4 .hero h2 small {
  display: inline;
  font-size: 20px;
}

.am4 .hero .row {
  margin-top: 24px;
}

.am4 .grid {
  display: grid;
  gap: 16px;
}

.am4 .two {
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
}

.am4 .four {
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
}

.am4 .stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.am4 .row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.am4 .right {
  text-align: right;
}

.am4 .row + .grid {
  margin-top: 18px;
}

.am4 .up {
  color: #fb7185;
}

.am4 .down {
  color: #60a5fa;
}

.am4 .alert {
  background: #352a16;
  border: 1px solid #8a632a;
  border-radius: 12px;
  color: #fde68a;
  padding: 14px;
  margin-bottom: 14px;
}

.am4 .empty {
  padding: 32px;
  text-align: center;
  color: #94a3b8;
}

.am4 .note {
  font-size: 12px;
  line-height: 1.8;
  color: #94a3b8;
}

.am4 .table {
  overflow-x: auto;
  margin-top: 16px;
}

.am4 table {
  border-collapse: collapse;
  width: 100%;
  min-width: 620px;
  font-variant-numeric: tabular-nums;
}

.am4 th,
.am4 td {
  padding: 14px 10px;
  border-bottom: 1px solid #253044;
  text-align: left;
}

.am4 th {
  font-size: 11px;
  color: #94a3b8;
}

.am4 th:not(:first-child),
.am4 td:not(:first-child) {
  text-align: right;
}

.am4 .memo {
  white-space: pre-wrap;
}

.am4 .list {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid #253044;
}

.am4 .list b {
  text-align: right;
}

.am4 .target {
  width: 160px;
  font-size: 12px;
  color: #a5b4fc;
}

.am4 .target input {
  text-align: right;
  margin-top: 6px;
  font-size: 16px;
}

.am4 .cloud {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.am4 .cloud input {
  flex: 1 1 220px;
}

.am4 footer {
  margin-top: 60px;
  padding: 24px 0;
  border-top: 1px solid #253044;
  text-align: center;
  color: #64748b;
  font-size: 11px;
}

@media (max-width: 800px) {
  .am4 .four {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .am4 .two {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .am4 {
    padding: 20px 12px;
  }

  .am4 .card,
  .am4 .hero {
    padding: 20px;
  }

  .am4 .stat {
    padding: 14px;
  }

  .am4 .right {
    text-align: left;
  }

  .am4 strong {
    font-size: 19px;
  }
}
`;
