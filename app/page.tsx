"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { EarthquakeMapItem } from "./components/earthquake-map";

const EarthquakeMap = dynamic(() => import("./components/earthquake-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-300">Memuat peta cluster…</div>
  ),
});

type EarthquakeItem = EarthquakeMapItem;

type ModelEvaluationItem = {
  model_name?: string;
  accuracy?: number | string;
  precision?: number | string;
  recall?: number | string;
  f1_score?: number | string;
  confusion_matrix?: number[][];
  confusion_matrix_labels?: string[];
};

type RiskLevelStats = {
  count?: number;
  percentage?: number;
};

type RiskDistributionScope = {
  total_records?: number;
  distribution?: Record<string, RiskLevelStats>;
};

type RiskDistribution = {
  with_noise?: RiskDistributionScope;
  without_noise?: RiskDistributionScope;
};

type YearCountItem = {
  year?: number | string;
  count?: number;
  start_date?: string;
  end_date?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
type NoiseMode = "without-noise" | "with-noise";

const RISK_LEVEL_ORDER = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW"];
const RISK_LEVEL_LABELS: Record<string, string> = {
  VERY_HIGH: "Very High",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const EVALUATION_METRICS: { key: "accuracy" | "precision" | "recall" | "f1_score"; label: string }[] = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1_score", label: "F1-Score" },
];

const MODEL_SERIES = [
  { name: "Random Forest", color: "#2E86AB" },
  { name: "XGBoost", color: "#A23B72" },
];

const CHART_HEIGHT = 260;
const NICE_AXIS_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1];

const CONFUSION_THEMES: Record<string, { light: [number, number, number]; dark: [number, number, number] }> = {
  "Random Forest": { light: [247, 251, 255], dark: [8, 48, 107] },
  XGBoost: { light: [252, 251, 253], dark: [63, 0, 125] },
};

function interpolateColor(light: [number, number, number], dark: [number, number, number], t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const channel = (index: number) => Math.round(light[index] + (dark[index] - light[index]) * clamped);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function computeNiceStep(range: number, targetTicks = 5) {
  if (range <= 0) return 1;

  const roughStep = range / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;

  const niceResidual = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;

  return niceResidual * magnitude;
}

function toNumber(value: number | string | undefined, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formatMonthName(dateValue?: string) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", { month: "long" });
}

export default function Home() {
  const [noiseMode, setNoiseMode] = useState<NoiseMode>("without-noise");
  const [mapPoints, setMapPoints] = useState<EarthquakeItem[]>([]);
  const [earthquakeSummaryPoints, setEarthquakeSummaryPoints] = useState<EarthquakeItem[]>([]);
  const [modelEvaluations, setModelEvaluations] = useState<ModelEvaluationItem[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<RiskDistribution | null>(null);
  const [clusterTotalRecords, setClusterTotalRecords] = useState(0);
  const [clusterNoNoiseTotalRecords, setClusterNoNoiseTotalRecords] = useState(0);
  const [recordsByYear, setRecordsByYear] = useState<YearCountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const mapUrl =
          noiseMode === "with-noise"
            ? `${API_BASE_URL}/earthquakes/clusters?dataset=hdbscan`
            : `${API_BASE_URL}/earthquakes/clusters/no_noise?dataset=hdbscan`;

        const [mapResponse, summaryEarthquakeResponse, modelEvaluationResponse] = await Promise.all([
          fetch(mapUrl, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/earthquakes?dataset=processed`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/earthquakes/model-evaluations`, { cache: "no-store" }),
        ]);

        if (!mapResponse.ok || !summaryEarthquakeResponse.ok || !modelEvaluationResponse.ok) {
          throw new Error("Gagal mengambil data dari backend API");
        }

        const mapData = await mapResponse.json();
        const summaryEarthquakeData = await summaryEarthquakeResponse.json();
        const modelEvaluationData = await modelEvaluationResponse.json();

        setMapPoints(Array.isArray(mapData.items) ? mapData.items : []);
        setEarthquakeSummaryPoints(Array.isArray(summaryEarthquakeData.items) ? summaryEarthquakeData.items : []);
        setModelEvaluations(Array.isArray(modelEvaluationData.items) ? modelEvaluationData.items : []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Terjadi kesalahan saat mengambil data gempa."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [noiseMode]);

  useEffect(() => {
    const fetchStaticSummaries = async () => {
      try {
        const [summaryResponse, clustersResponse, clustersNoNoiseResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/earthquakes/summary?dataset=hdbscan`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/earthquakes/clusters?dataset=hdbscan&limit=1`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/earthquakes/clusters/no_noise?dataset=hdbscan&limit=1`, { cache: "no-store" }),
        ]);

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          if (summaryData.risk_distribution) {
            setRiskDistribution(summaryData.risk_distribution as RiskDistribution);
          }
          if (Array.isArray(summaryData.records_by_year)) {
            setRecordsByYear(summaryData.records_by_year as YearCountItem[]);
          }
        }

        if (clustersResponse.ok) {
          const clustersData = await clustersResponse.json();
          if (typeof clustersData.total_records === "number") {
            setClusterTotalRecords(clustersData.total_records);
          }
        }

        if (clustersNoNoiseResponse.ok) {
          const clustersNoNoiseData = await clustersNoNoiseResponse.json();
          if (typeof clustersNoNoiseData.total_records === "number") {
            setClusterNoNoiseTotalRecords(clustersNoNoiseData.total_records);
          }
        }
      } catch {
        // Both panels are supplementary; ignore failures silently.
      }
    };

    fetchStaticSummaries();
  }, []);

  const activeRiskDistribution =
    noiseMode === "with-noise" ? riskDistribution?.with_noise : riskDistribution?.without_noise;

  const getLocationLabel = (item?: EarthquakeItem) => {
    return item?.place ?? item?.location ?? "Lokasi tidak tersedia";
  };

  const summary = useMemo(() => {
    const orderedPoints = [...earthquakeSummaryPoints].sort((left, right) => {
      const leftMagnitude = toNumber(left.magnitude);
      const rightMagnitude = toNumber(right.magnitude);
      return rightMagnitude - leftMagnitude;
    });

    const highestEarthquake = orderedPoints[0];
    const lowestEarthquake = orderedPoints[orderedPoints.length - 1];

    const getScore = (modelName: string) => {
      const evaluation = modelEvaluations.find(
        (item) => item.model_name?.toLowerCase() === modelName.toLowerCase()
      );

      if (!evaluation) {
        return 0;
      }

      const accuracy = toNumber(evaluation.accuracy);
      const precision = toNumber(evaluation.precision);
      const recall = toNumber(evaluation.recall);
      const f1Score = toNumber(evaluation.f1_score);

      return (accuracy + precision + recall + f1Score) / 4;
    };

    return {
      lowestMagnitude: toNumber(lowestEarthquake?.magnitude),
      lowestLocation: getLocationLabel(lowestEarthquake),
      highestMagnitude: toNumber(highestEarthquake?.magnitude),
      highestLocation: getLocationLabel(highestEarthquake),
      randomForestScore: getScore("Random Forest"),
      xgboostScore: getScore("XGBoost"),
    };
  }, [earthquakeSummaryPoints, modelEvaluations]);

  return (
    <main className="min-h-screen bg-[#041827] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <div className="rounded-[22px] border border-slate-700 bg-[#081d2d] p-4 shadow-[0_10px_35px_rgba(2,6,23,0.7)]">
          <div className="flex flex-col gap-4">
            <aside className="rounded-[18px] border border-slate-700 bg-[#0b1d2d] p-4">
              <h3 className="mb-4 text-[18px] font-semibold text-slate-100">Summary Earthquakes</h3>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard label="Total With Noise" value={clusterTotalRecords.toLocaleString()} />
                <SummaryCard label="Total Without Noise" value={clusterNoNoiseTotalRecords.toLocaleString()} />
                <SummaryCard label="Lowest Magnitude" value={`${summary.lowestMagnitude.toFixed(2)} - ${summary.lowestLocation}`} />
                <SummaryCard label="Highest Magnitude" value={`${summary.highestMagnitude.toFixed(2)} - ${summary.highestLocation}`}/>
              </div>
            </aside>

            <div className="overflow-hidden rounded-[18px] border border-slate-700 bg-[#0d2338]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
                <h2 className="text-[14px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                  Earthquakes Map by Cluster
                </h2>

                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <span className="font-medium text-slate-300">Filter cluster</span>
                  <select
                    value={noiseMode}
                    onChange={(event) => setNoiseMode(event.target.value as NoiseMode)}
                    className="rounded-xl border border-sky-500/40 bg-[#0b1d2d] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  >
                    <option value="without-noise">Tanpa noise</option>
                    <option value="with-noise">Dengan noise</option>
                  </select>
                </label>
              </div>

              <div className="relative h-177.5 w-full">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    Memuat peta cluster…
                  </div>
                ) : error ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-200">
                    {error}
                  </div>
                ) : (
                  <>
                    <EarthquakeMap points={mapPoints} />
                    <RiskDistributionPanel scope={activeRiskDistribution} />
                  </>
                )}
              </div>

            </div>

            <div className="rounded-[18px] border border-slate-700 bg-[#0d2338] p-4">
              <h3 className="mb-4 text-[18px] font-semibold text-slate-100">Evaluation Models</h3>
              <ModelEvaluationChart modelEvaluations={modelEvaluations} />

              <ModelSummaryPanel
                randomForestScore={summary.randomForestScore}
                xgboostScore={summary.xgboostScore}
              />
            </div>

            <div className="rounded-[18px] border border-slate-700 bg-[#0d2338] p-4">
              <h3 className="mb-4 text-[18px] font-semibold text-slate-100">
                Earthquake Record Distribution By Year
              </h3>
              <YearDistributionChart data={recordsByYear} />
            </div>

            <div className="rounded-[18px] border border-slate-700 bg-[#0d2338] p-4">
              <h3 className="mb-4 text-[18px] font-semibold text-slate-100">Confusion Matrix</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <ConfusionMatrixCard
                  model={modelEvaluations.find(
                    (item) => item.model_name?.toLowerCase() === "random forest"
                  )}
                  fallbackName="Random Forest"
                />
                <ConfusionMatrixCard
                  model={modelEvaluations.find(
                    (item) => item.model_name?.toLowerCase() === "xgboost"
                  )}
                  fallbackName="XGBoost"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-[#101f30] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
        <span className="h-3 w-12 rounded-full" />
      </div>
      <div className="text-[13px] font-medium text-slate-100">{value}</div>
    </div>
  );
}

function RiskDistributionPanel({ scope }: { scope?: RiskDistributionScope }) {
  const distribution = scope?.distribution;

  return (
    <div className="absolute right-3 top-3 z-1000 w-52 rounded-xl border border-slate-700 bg-[#0b1d2d]/95 p-3 text-xs text-slate-100 shadow-lg backdrop-blur">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Risk Distribution
      </p>

      <div className="space-y-1 font-medium">
        {RISK_LEVEL_ORDER.map((level) => {
          const count = distribution?.[level]?.count ?? 0;
          const percentage = distribution?.[level]?.percentage ?? 0;

          return (
            <div key={level}>
              {RISK_LEVEL_LABELS[level]} : {count.toLocaleString()} ({percentage.toFixed(2)}%)
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModelEvaluationChart({ modelEvaluations }: { modelEvaluations: ModelEvaluationItem[] }) {
  const series = MODEL_SERIES.map((model) => ({
    ...model,
    data: modelEvaluations.find((item) => item.model_name?.toLowerCase() === model.name.toLowerCase()),
  }));

  const allValues = series.flatMap((model) =>
    EVALUATION_METRICS.map((metric) => toNumber(model.data?.[metric.key]))
  );
  const hasData = allValues.some((value) => value > 0);

  if (!hasData) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        Belum ada data evaluasi model.
      </div>
    );
  }

  const maxValue = Math.max(...allValues);
  const minValue = Math.min(...allValues);
  const rawStep = (maxValue - minValue || 0.05) / 5;
  const step = NICE_AXIS_STEPS.find((candidate) => candidate >= rawStep) ?? 1;

  const yMax = Math.min(1, Math.ceil(maxValue / step) * step);
  const yMin = Math.max(0, Math.floor(minValue / step) * step);
  const range = yMax - yMin || step;
  const tickCount = Math.round((yMax - yMin) / step) + 1;
  const yTicks = Array.from({ length: tickCount }, (_, index) => yMax - index * step);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">
          Model Performance Comparison: Random Forest vs XGBoost
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-300">
          {MODEL_SERIES.map((model) => (
            <span key={model.name} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: model.color }} />
              {model.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center justify-center">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Score
          </span>
        </div>

        <div
          className="flex w-12 flex-col justify-between text-right text-[11px] text-slate-400"
          style={{ height: CHART_HEIGHT }}
        >
          {yTicks.map((tick) => (
            <span key={tick.toFixed(4)}>{tick.toFixed(2)}</span>
          ))}
        </div>

        <div className="flex-1">
          <div className="relative" style={{ height: CHART_HEIGHT }}>
            <div className="absolute inset-0 flex flex-col justify-between">
              {yTicks.map((tick) => (
                <div key={tick.toFixed(4)} className="border-t border-slate-700/50" />
              ))}
            </div>

            <div className="relative flex h-full items-end justify-around gap-2 px-2">
              {EVALUATION_METRICS.map((metric) => (
                <div key={metric.key} className="flex h-full flex-1 justify-center gap-1.5">
                  {series.map((model) => {
                    const value = toNumber(model.data?.[metric.key]);
                    const heightPct = Math.max(0, Math.min(100, ((value - yMin) / range) * 100));

                    return (
                      <div key={model.name} className="flex w-8 flex-col items-center justify-end">
                        <span className="mb-1 text-[10px] font-semibold text-slate-200">
                          {value.toFixed(4)}
                        </span>
                        <div
                          className="w-full rounded-t-sm"
                          style={{ height: `${heightPct}%`, backgroundColor: model.color }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 flex justify-around px-2 text-xs font-medium text-slate-300">
            {EVALUATION_METRICS.map((metric) => (
              <span key={metric.key} className="flex-1 text-center">
                {metric.label}
              </span>
            ))}
          </div>

          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Evaluation Metrics
          </p>
        </div>
      </div>
    </div>
  );
}

function ModelSummaryPanel({
  randomForestScore,
  xgboostScore,
}: {
  randomForestScore: number;
  xgboostScore: number;
}) {
  const optimalModel = randomForestScore >= xgboostScore ? MODEL_SERIES[0] : MODEL_SERIES[1];

  return (
    <div className="mt-4 rounded-xl border border-slate-700 bg-[#101f30] p-4">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MODEL_SERIES[0].color }} />
          <span className="text-slate-300">Average {MODEL_SERIES[0].name}</span>
          <span className="font-mono font-semibold text-slate-100">{randomForestScore.toFixed(4)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MODEL_SERIES[1].color }} />
          <span className="text-slate-300">Average {MODEL_SERIES[1].name}</span>
          <span className="font-mono font-semibold text-slate-100">{xgboostScore.toFixed(4)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-700 pt-3 text-sm">
        <span className="font-semibold uppercase tracking-[0.06em] text-emerald-400">
          Optimal Model:
        </span>
        <span className="font-semibold text-slate-100">{optimalModel.name}</span>
      </div>
    </div>
  );
}

const YEAR_BAR_COLOR = "#2E86AB";

function YearDistributionChart({ data }: { data: YearCountItem[] }) {
  const points = data
    .map((item) => ({
      year: toNumber(item.year),
      count: toNumber(item.count),
      startDate: item.start_date,
      endDate: item.end_date,
    }))
    .filter((item) => Number.isFinite(item.year) && item.year > 0)
    .sort((a, b) => a.year - b.year);

  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        Belum ada data distribusi tahun.
      </div>
    );
  }

  const totalRecords = points.reduce((sum, point) => sum + point.count, 0);
  const yearRange =
    points.length > 1 ? `${points[0].year}-${points[points.length - 1].year}` : `${points[0].year}`;

  const maxCount = Math.max(...points.map((point) => point.count));
  const step = computeNiceStep(maxCount);
  const yMax = Math.ceil(maxCount / step) * step || step;
  const tickCount = Math.round(yMax / step) + 1;
  const yTicks = Array.from({ length: tickCount }, (_, index) => yMax - index * step);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Earthquake Records After Processed and Clustered</p>
          <p className="text-xs text-slate-400">Asia Region (USGS Data)</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-[#101f30] px-3 py-2 text-xs text-slate-300">
          <div>Total Records: {totalRecords.toLocaleString()}</div>
          <div>Year Range: {yearRange}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center justify-center">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Number of Earthquake Records
          </span>
        </div>

        <div
          className="flex w-14 flex-col justify-between text-right text-[11px] text-slate-400"
          style={{ height: CHART_HEIGHT }}
        >
          {yTicks.map((tick) => (
            <span key={tick.toString()}>{Math.round(tick).toLocaleString()}</span>
          ))}
        </div>

        <div className="flex-1">
          <div className="relative" style={{ height: CHART_HEIGHT }}>
            <div className="absolute inset-0 flex flex-col justify-between">
              {yTicks.map((tick) => (
                <div key={tick.toString()} className="border-t border-slate-700/50" />
              ))}
            </div>

            <div className="relative flex h-full items-end justify-around gap-3 px-2">
              {points.map((point) => {
                const heightPct = Math.max(0, Math.min(100, (point.count / yMax) * 100));
                const startMonth = formatMonthName(point.startDate);
                const endMonth = formatMonthName(point.endDate);
                const rangeLabel =
                  startMonth && endMonth
                    ? startMonth === endMonth
                      ? startMonth
                      : `${startMonth} - ${endMonth}`
                    : null;

                return (
                  <div key={point.year} className="flex h-full flex-1 flex-col items-center justify-end">
                    <span className="mb-1 text-[11px] font-semibold text-slate-200">
                      {point.count.toLocaleString()}
                    </span>
                    <div
                      className="group relative w-16 max-w-[70%] cursor-default rounded-t-sm transition-[filter] hover:brightness-110"
                      style={{ height: `${heightPct}%`, backgroundColor: YEAR_BAR_COLOR }}
                    >
                      {rangeLabel && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-[#0b1d2d] px-2 py-1 text-[11px] font-medium text-slate-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                          {rangeLabel}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex justify-around px-2 text-xs font-medium text-slate-300">
            {points.map((point) => (
              <span key={point.year} className="flex-1 text-center">
                {point.year}
              </span>
            ))}
          </div>

          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Year (Data Ingestion Timeline)
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfusionMatrixCard({
  model,
  fallbackName,
}: {
  model: ModelEvaluationItem | undefined;
  fallbackName: string;
}) {
  const displayName = model?.model_name ?? fallbackName;
  const theme = CONFUSION_THEMES[displayName] ?? CONFUSION_THEMES["Random Forest"];
  const labels = model?.confusion_matrix_labels;
  const matrix = model?.confusion_matrix;

  if (!model || !labels || !matrix || matrix.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-[#101f30] p-4">
        <p className="mb-3 text-sm font-semibold text-slate-100">{displayName} - Confusion Matrix</p>
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          Belum ada data confusion matrix.
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...matrix.flat(), 1);

  return (
    <div className="rounded-xl border border-slate-700 bg-[#101f30] p-4">
      <p className="mb-3 text-sm font-semibold text-slate-100">{model.model_name} - Confusion Matrix</p>

      <div className="flex gap-2">
        <div className="flex items-center justify-center">
          <span
            className="text-[11px] font-semibold uppercase tracking-widest text-slate-400"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            True Label
          </span>
        </div>

        <div
          className="grid flex-1 gap-1"
          style={{ gridTemplateColumns: `minmax(56px, auto) repeat(${labels.length}, minmax(0, 1fr))` }}
        >
          <div />
          {labels.map((label) => (
            <div
              key={`col-${label}`}
              className="flex items-end justify-center pb-1 text-center text-[10px] font-medium text-slate-300"
            >
              {label}
            </div>
          ))}

          {matrix.map((row, rowIndex) => (
            <Fragment key={`row-${labels[rowIndex]}`}>
              <div className="flex items-center justify-end pr-2 text-[10px] font-medium text-slate-300">
                {labels[rowIndex]}
              </div>
              {row.map((value, colIndex) => {
                const t = value / maxValue;
                const bg = interpolateColor(theme.light, theme.dark, t);
                const textColor = t > 0.5 ? "#f8fafc" : "#1e293b";

                return (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className="flex aspect-square items-center justify-center rounded-md text-sm font-semibold"
                    style={{ backgroundColor: bg, color: textColor }}
                  >
                    {value.toLocaleString()}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        Predicted Label
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-slate-400">0</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(to right, rgb(${theme.light.join(",")}), rgb(${theme.dark.join(",")}))`,
          }}
        />
        <span className="text-[10px] text-slate-400">{maxValue.toLocaleString()}</span>
      </div>
    </div>
  );
}
