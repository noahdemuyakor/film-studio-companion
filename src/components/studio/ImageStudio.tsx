"use client";
import NextLink from "next/link";
import { useState } from "react";
import { modelById, useStudio } from "@/lib/store";
import { produceShot } from "@/lib/router";
import { ASPECTS } from "@/lib/presets";
import type { Shot } from "@/lib/types";
import { uid } from "@/lib/util";
import Scene from "../Scene";
import { At, Book, ChevronR, Close, Diamond, Expand, Grid, Minus, Plus, Spark } from "../Icons";
import { Select } from "../ui";
import { PayWith, RefPicker, ShotCard, usePrice, type PickedRef } from "./shared";
import { useHydrated } from "../Hydrate";

export default function ImageStudio() {
  const st = useStudio();
  const hydrated = useHydrated();
  const [text, setText] = useState("");
  const [aspect, setAspect] = useState("Auto");
  const [quality, setQuality] = useState("High");
  const [res, setRes] = useState("2K");
  const [batch, setBatch] = useState(1);
  const [banner, setBanner] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refs, setRefs] = useState<PickedRef[]>([]);
  const imageModels = st.models.filter((m) => m.kind === "image" && m.enabled);
  const model = modelById(st.models, st.imageModelId);
  const price = usePrice(model, 0);

  const [hint, setHint] = useState("");
  const generate = async () => {
    if (!text.trim()) {
      setHint("Describe the image first.");
      return;
    }
    setHint("");
    setBusy(true);
    const settings = { ...st.settings, aspect: aspect === "Auto" ? "1:1" : aspect, resolution: res, duration: 0 };
    const temps: Shot[] = Array.from({ length: batch }, (_, k) => ({
      id: uid("tmp"),
      title: `Image ${st.images.length + k + 1}`,
      prompt: text,
      compiled: "",
      continuity: "",
      modelId: model.id,
      settings,
      refIds: st.refIds,
      castIds: st.castIds,
      extendBack: 0,
      extendForward: 0,
      status: "compiling",
      seed: Math.floor(Math.random() * 99999),
      credits: model.cost,
      createdAt: Date.now(),
    }));
    st.update("images", (v) => [...temps, ...v]);
    // A locked character joins the image only when the prompt names them or asks for a person; otherwise the prompt's own subject stands alone.
    const wantsPerson = /\b(person|people|man|men|woman|women|girl|boy|child|someone|somebody|character|portrait|face|she|he|her|him|they|actor|actress|model|couple|crowd)\b/i.test(text);
    const cast = st.cast.filter((c) => st.castIds.includes(c.id) && (wantsPerson || new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)));
    await Promise.all(
      temps.map(async (t) => {
        const shot = await produceShot({ title: t.title, prompt: `${text}${quality === "High" ? ", highly detailed" : ""}`, model, settings, cast, refs: st.vault.filter((r) => st.refIds.includes(r.id)), media: refs.map((r) => ({ role: "ref" as const, url: r.url })) });
        useStudio.getState().update("images", (v) => v.map((x) => (x.id === t.id ? { ...shot, title: t.title } : x)));
      }),
    );
    setBusy(false);
  };

  const hasImages = hydrated && st.images.length > 0;

  return (
    <div className="relative max-w-app mx-auto min-h-[calc(100vh-112px)] md:min-h-[calc(100vh-84px)] px-4 pb-[150px]">
      <div className="flex justify-end">
        <button className="h-8 px-2.5 rounded-8 border border-w10 text-14 font-semibold flex items-center gap-2">
          <Grid size={14} /> View
        </button>
      </div>
      {banner && (
        <aside aria-label="Getting started" className="mx-auto mt-2.5 max-w-[458px] h-[58px] rounded-full bg-panel-2 border border-w5 flex items-center gap-3 p-[10px]">
          <span className="w-[38px] h-[38px] rounded-full bg-w5 grid place-items-center shrink-0">
            <Book size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-14 font-semibold truncate">Don&apos;t know where to start?</span>
            <span className="block text-12 text-w40 truncate">Try a character sheet, then lock it in the vault</span>
          </span>
          <NextLink href="/ai/video/#vault" className="h-9 px-3 rounded-full bg-white text-dark text-12 font-semibold flex items-center shrink-0">
            Learn now
          </NextLink>
          <button aria-label="Close" onClick={() => setBanner(false)} className="w-9 h-9 rounded-full bg-w5 grid place-items-center shrink-0">
            <Close size={16} />
          </button>
        </aside>
      )}
      {hasImages ? (
        <div className="max-w-app mx-auto mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {st.images.map((img) => (
            <ShotCard key={img.id} shot={img} onDelete={() => st.update("images", (v) => v.filter((x) => x.id !== img.id))} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center mt-[72px] md:mt-16">
          <div className="flex items-center -space-x-3 h-[90px] md:h-[160px]">
            {["portrait", "dusk", "face", "creator"].map((n, k) => (
              <Scene
                key={n}
                name={n}
                className={`border-[3px] border-[#4b4f55] ${k === 2 ? "rounded-full w-[64px] h-[64px] md:w-[140px] md:h-[140px]" : "rounded-12 w-[62px] h-[56px] md:w-[140px] md:h-[150px]"}`}
                style={{ transform: `rotate(${[-8, 4, 0, 4][k]}deg)` }}
              />
            ))}
          </div>
          <h1 className="mt-4 font-display font-bold uppercase text-20 md:text-36 leading-[1] md:leading-9">
            Start creating with
            <br />
            <span className="text-lime">Film Studio Soul Cinema</span>
          </h1>
          <p className="mt-3 text-16 text-mute max-w-[340px] md:max-w-none">Describe a scene, character, mood or style — and watch it come to life</p>
        </div>
      )}
      <div className="fixed md:absolute bottom-3 md:bottom-[18px] left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[880px] md:max-w-[calc(100%-32px)] z-20">
        <form aria-label="Prompt" onSubmit={(e) => (e.preventDefault(), generate())} className="rounded-16 bg-[#2a3136] border border-w5 p-[10px] flex gap-3 shadow-2xl">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
          <textarea aria-label="Image prompt" value={text} onChange={(e) => {
            setText(e.target.value);
            if (hint) setHint("");
          }} placeholder="Describe the scene you imagine" className="w-full h-10 bg-transparent resize-none outline-none text-14 px-1.5 pt-1 placeholder:text-w50" />
          {hint && <p className="text-12 text-[#ff5c9a] px-1.5">{hint}</p>}
          <div className="flex items-center gap-1.5 flex-wrap">
            <RefPicker refs={refs} onChange={setRefs} />
            <button type="button" aria-label="Mention element" className="w-8 h-8 rounded-8 bg-w5 grid place-items-center">
              <At size={14} />
            </button>
            <div className="h-8 px-2.5 rounded-8 bg-w5 flex items-center gap-1.5 text-14 font-semibold">
              <Spark size={14} className="text-lime" />
              <Select label="Image model" value={st.imageModelId} onChange={(v) => st.set({ imageModelId: v })} options={imageModels.map((m) => ({ id: m.id, label: m.name }))} className="w-auto" />
              <ChevronR size={12} />
            </div>
            <button type="button" onClick={() => setAspect(["Auto", ...ASPECTS.map((a) => a.id)][(["Auto", ...ASPECTS.map((a) => a.id)].indexOf(aspect) + 1) % 5])} className="h-8 px-2.5 rounded-8 bg-w5 text-14 font-semibold flex items-center gap-1.5">
              <Expand size={14} /> {aspect}
            </button>
            <button type="button" onClick={() => setQuality(quality === "High" ? "Draft" : "High")} className="h-8 px-2.5 rounded-8 bg-w5 text-14 font-semibold flex items-center gap-1.5">
              <Diamond size={14} /> {quality}
            </button>
            <button type="button" onClick={() => setRes(res === "2K" ? "4K" : res === "4K" ? "1K" : "2K")} className="h-8 px-2.5 rounded-8 bg-w5 text-14 font-semibold flex items-center gap-1.5">
              <Diamond size={14} /> {res}
            </button>
            <div className="h-8 px-2 rounded-8 bg-w5 text-14 font-semibold flex items-center gap-2">
              <button type="button" aria-label="Fewer" onClick={() => setBatch(Math.max(1, batch - 1))} className="text-w50">
                <Minus size={12} />
              </button>
              {batch}/4
              <button type="button" aria-label="More" onClick={() => setBatch(Math.min(4, batch + 1))}>
                <Plus size={12} />
              </button>
            </div>
            <PayWith modelId={st.imageModelId} />
          </div>
          </div>
          <aside className="shrink-0 w-[92px] md:w-[120px] flex flex-col gap-1.5">
          <button type="submit" disabled={busy} className="btn-lime flex-1 rounded-12 text-12 font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-60">
            {busy ? "WORKING…" : st.liveRenders ? "GENERATE" : "PREVIEW"}
            <span className="flex items-center gap-1">{st.liveRenders ? <><Spark size={12} /> {price * batch}</> : "free"}</span>
          </button>
          </aside>
        </form>
      </div>
    </div>
  );
}
