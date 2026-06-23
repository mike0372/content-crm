"use client";

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Circle,
  G,
  pdf,
} from "@react-pdf/renderer";
import { Video, Pillar, PILLARS, PILLAR_HEX, STATUS_LABELS } from "@/lib/types";

export interface WeekPdfData {
  weekLabel: string;
  rangeLabel: string;
  days: { label: string; date: string; video: Video | null }[];
  videos: Video[];
}

const C = {
  ink: "#18181b",
  sub: "#52525b",
  faint: "#a1a1aa",
  line: "#e4e4e7",
  accent: "#3b82f6",
  box: "#f4f4f5",
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: C.ink, fontFamily: "Helvetica" },
  coverPage: { padding: 56, color: C.ink, fontFamily: "Helvetica" },
  h1: { fontSize: 30, fontFamily: "Helvetica-Bold", letterSpacing: -0.5 },
  kicker: { fontSize: 10, color: C.accent, letterSpacing: 2, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  row: { flexDirection: "row" },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  dot: { width: 9, height: 9, borderRadius: 4.5, marginRight: 8 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: C.box,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  td: { paddingVertical: 6, paddingHorizontal: 8 },
  trBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  cellLabel: { fontSize: 8, color: C.faint, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 8,
    color: "#fff",
  },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 12, marginBottom: 12 },
  beatRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5 },
  checkbox: { width: 9, height: 9, borderWidth: 1, borderColor: C.sub, borderRadius: 2, marginRight: 7 },
});

function Donut({ counts }: { counts: Record<Pillar, number> }) {
  const total = PILLARS.reduce((a, p) => a + counts[p], 0) || 1;
  const r = 52;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <G transform="rotate(-90 70 70)">
        <Circle cx={70} cy={70} r={r} stroke={C.box} strokeWidth={16} fill="transparent" />
        {PILLARS.map((p) => {
          const val = counts[p];
          if (!val) return null;
          const seg = (val / total) * circ;
          const el = (
            <Circle
              key={p}
              cx={70}
              cy={70}
              r={r}
              stroke={PILLAR_HEX[p]}
              strokeWidth={16}
              fill="transparent"
              strokeDasharray={`${seg} ${circ - seg}`}
              strokeDashoffset={-acc}
            />
          );
          acc += seg;
          return el;
        })}
      </G>
      <Text x={70} y={74} style={{ fontSize: 20, fontFamily: "Helvetica-Bold" }} textAnchor="middle">
        {total}
      </Text>
    </Svg>
  );
}

function pillarColorBadge(label: string, color: string) {
  return <Text style={[s.badge, { backgroundColor: color }]}>{label}</Text>;
}

function CoverPage({ data, counts }: { data: WeekPdfData; counts: Record<Pillar, number> }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <Text style={s.kicker}>REELROOM · CONTENT CALENDAR</Text>
      <Text style={[s.h1, { marginTop: 8 }]}>Week {data.weekLabel}</Text>
      <Text style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>{data.rangeLabel}</Text>

      <View style={{ height: 1, backgroundColor: C.line, marginVertical: 28 }} />

      <Text style={s.sectionTitle}>Pillar split</Text>
      <View style={[s.row, { alignItems: "center" }]}>
        <Donut counts={counts} />
        <View style={{ marginLeft: 36 }}>
          {PILLARS.map((p) => (
            <View key={p} style={s.legendRow}>
              <View style={[s.dot, { backgroundColor: PILLAR_HEX[p] }]} />
              <Text style={{ width: 110 }}>{p}</Text>
              <Text style={{ color: C.sub }}>{counts[p]} reel(s)</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ position: "absolute", bottom: 56, left: 56 }}>
        <Text style={{ color: C.faint, fontSize: 9 }}>
          {data.videos.length} reels scheduled · generated {new Date().toLocaleDateString()}
        </Text>
      </View>
    </Page>
  );
}

function OverviewPage({ data }: { data: WeekPdfData }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionTitle}>Week overview</Text>
      <View style={s.tableHead}>
        <Text style={{ width: "14%" }}>Day</Text>
        <Text style={{ width: "40%" }}>Hook</Text>
        <Text style={{ width: "20%" }}>Pillar</Text>
        <Text style={{ width: "14%" }}>Window</Text>
        <Text style={{ width: "12%" }}>Status</Text>
      </View>
      {data.days.map((d) => (
        <View key={d.label} style={[s.row, s.trBorder]}>
          <Text style={[s.td, { width: "14%" }]}>
            {d.label.slice(0, 3)} {d.date}
          </Text>
          <Text style={[s.td, { width: "40%" }]}>
            {d.video ? d.video.hook.line1 || d.video.title : "—"}
          </Text>
          <View style={[s.td, { width: "20%" }]}>
            {d.video ? pillarColorBadge(d.video.pillar, PILLAR_HEX[d.video.pillar]) : <Text>—</Text>}
          </View>
          <Text style={[s.td, { width: "14%" }]}>
            {d.video ? d.video.postingWindow.split(" ")[0] : "—"}
          </Text>
          <Text style={[s.td, { width: "12%" }]}>
            {d.video ? STATUS_LABELS[d.video.status] : "—"}
          </Text>
        </View>
      ))}
    </Page>
  );
}

function VideoPage({ v }: { v: Video }) {
  const rec = v.captions.find((c) => c.recommended) ?? v.captions[0];
  return (
    <Page size="A4" style={s.page}>
      <View style={s.row}>
        {pillarColorBadge(v.pillar, PILLAR_HEX[v.pillar])}
        <Text style={{ marginLeft: 8, color: C.sub, fontSize: 9 }}>
          {v.format} · {v.lengthTarget} · {v.postingWindow}
        </Text>
      </View>
      <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 12 }}>
        {v.title}
      </Text>

      {/* Hook */}
      <View style={s.card}>
        <Text style={s.cellLabel}>HOOK</Text>
        <Text style={{ fontSize: 13, marginTop: 4 }}>{v.hook.line1 || "—"}</Text>
        {!!v.hook.line2 && <Text style={{ color: C.sub, marginTop: 2 }}>{v.hook.line2}</Text>}
        {!!v.hook.firstTwoSeconds && (
          <Text style={{ marginTop: 6, color: C.sub }}>
            First 2s: {v.hook.firstTwoSeconds}
          </Text>
        )}
      </View>

      {/* Script */}
      <Text style={[s.cellLabel, { marginBottom: 4 }]}>SCRIPT BEATS</Text>
      <View style={{ marginBottom: 12 }}>
        {v.script.map((b) => (
          <View key={b.id} style={s.beatRow}>
            <Text style={{ width: "12%", color: C.sub }}>{b.timestamp}</Text>
            <Text style={{ width: "16%", fontFamily: "Helvetica-Bold" }}>{b.label}</Text>
            <Text style={{ width: "72%" }}>{b.content || "—"}</Text>
          </View>
        ))}
      </View>

      {/* Caption */}
      <View style={s.card}>
        <Text style={s.cellLabel}>RECOMMENDED CAPTION ({rec?.variant ?? "—"})</Text>
        <Text style={{ marginTop: 4 }}>{rec?.text || "—"}</Text>
        {!!rec?.hashtags && <Text style={{ marginTop: 4, color: C.accent }}>{rec.hashtags}</Text>}
      </View>

      {/* Engagement */}
      <View style={s.card}>
        <Text style={s.cellLabel}>ENGAGEMENT PLAN</Text>
        <Text style={{ marginTop: 4 }}>Trigger: {v.engagement.triggerType || "—"} — {v.engagement.triggerText || "—"}</Text>
        <Text style={{ marginTop: 2 }}>First comment: {v.engagement.firstComment || "—"}</Text>
        <Text style={{ marginTop: 2 }}>End card: {v.engagement.endCard || "—"}</Text>
      </View>

      {/* Checklist */}
      <Text style={[s.cellLabel, { marginBottom: 4 }]}>SHOOTING CHECKLIST</Text>
      <View style={{ marginBottom: 12 }}>
        {v.checklist.map((item) => (
          <View key={item.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
            <View style={[s.checkbox, item.checked && { backgroundColor: C.ink }]} />
            <Text style={{ color: C.faint, width: 90, fontSize: 8 }}>{item.group}</Text>
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Results */}
      <View style={[s.card, { backgroundColor: C.box, borderWidth: 0 }]}>
        <Text style={s.cellLabel}>RESULTS</Text>
        {v.results.viewsIG != null || v.results.viewsFB != null ? (
          <Text style={{ marginTop: 4 }}>
            IG {v.results.viewsIG ?? 0} · FB {v.results.viewsFB ?? 0} · skip {v.results.skipRate ?? 0}% ·
            top {v.results.topSource || "—"} · {v.results.verdict || "—"}
          </Text>
        ) : (
          <Text style={{ marginTop: 4, color: C.faint }}>Not yet posted — fill after publishing.</Text>
        )}
      </View>
    </Page>
  );
}

export async function generateWeekPdf(data: WeekPdfData) {
  const counts = PILLARS.reduce(
    (acc, p) => {
      acc[p] = data.videos.filter((v) => v.pillar === p).length;
      return acc;
    },
    {} as Record<Pillar, number>
  );

  const doc = (
    <Document title={`ReelRoom Week ${data.weekLabel}`}>
      <CoverPage data={data} counts={counts} />
      <OverviewPage data={data} />
      {data.videos.map((v) => (
        <VideoPage key={v.id} v={v} />
      ))}
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reelroom-week-${data.weekLabel}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
