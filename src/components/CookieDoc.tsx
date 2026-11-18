"use client";
import NextLink from "next/link";
import { useState } from "react";
import { ChevronD } from "./Icons";
import { CookiePreferences } from "./Cookies";

const CATS = [
  {
    t: "Essential",
    b: "These cookies keep the studio working: signing you in, keeping your session secure and remembering the choices you make in Cookie Preferences. They can't be switched off in Cookie Preferences. Blocking them in your browser may stop core features such as saving projects from working.",
    rows: [
      ["fsc_session", "Keeps you signed in", "Session"],
      ["fsc_csrf", "Protects forms against forgery", "Session"],
      ["fsc_consent", "Stores your cookie choices", "12 months"],
    ],
  },
  {
    t: "Analytics & Customization",
    b: "These technologies support product analytics, experiments, personalisation and referral measurement. Which controls apply depends on their purpose and the law where you live. Only qualifying product analytics may stay on under “Your cookie choices”; this category is otherwise not exempt from consent or opt-outs.",
    rows: [
      ["fsc_metrics", "Counts which studio tools are opened", "13 months"],
      ["fsc_ab", "Remembers which experiment variant you saw", "90 days"],
    ],
  },
  {
    t: "Performance & Functionality",
    b: "These cookies remember preferences such as panel sizes, timeline zoom and the last studio you used, and help pages load quickly. Turning them off in Cookie Preferences may mean the studio forgets optional preferences.",
    rows: [["fsc_layout", "Remembers panel and timeline layout", "6 months"]],
  },
  {
    t: "Advertising",
    b: "These cookies help us show relevant offers for Film Studio Companion on other sites and measure whether they worked.",
    rows: [["fsc_ad_click", "Links an ad click to a sign-up", "90 days"]],
  },
];

export default function CookieDoc() {
  const [open, setOpen] = useState<string[]>([]);
  const [prefs, setPrefs] = useState(false);
  return (
    <article className="text-16 leading-6 text-white">
      <header className="text-center">
        <h1 className="font-display font-bold text-48 leading-[58px] tracking-tight">Cookie Notice</h1>
        <p className="text-20 leading-7 mt-0.5 text-soft">Last updated: November 17, 2026</p>
      </header>
      <section className="mt-10 flex flex-col gap-6">
        <p>
          This Cookie Notice explains how Film Studio Companion (&quot;we&quot;, &quot;us&quot; or &quot;our&quot;) and our providers use cookies, pixels
          and similar technologies to run and improve the studio and measure our marketing. Analytics may be linked to your browser or account, and
          advertising partners may use information for their own permitted purposes. We ask for consent and offer opt-outs where required. Your choices,
          including browser controls, are described below.
        </p>
        <p>
          For more about how we handle personal information, read our <NextLink href="/" className="text-lime">Privacy Policy</NextLink>.
        </p>
        <div>
          <p className="font-semibold">Your cookie choices</p>
          <p>
            Use the{" "}
            <button id="settings" onClick={() => setPrefs(true)} className="text-lime underline">
              Cookie settings
            </button>{" "}
            link to open Cookie Preferences and manage the choices available where you live, even if you never saw a banner. Closing the banner or carrying on
            browsing does not count as consent where consent is required.
          </p>
          <ul className="list-disc pl-6 mt-3 flex flex-col gap-2">
            <li>
              <b>Opt-in regions:</b> In the EEA, the United Kingdom, Switzerland, Canada and other opt-in regions, non-essential analytics and advertising stay
              off until you agree. You can refuse or withdraw consent at any time in Cookie Preferences, which stops the collection and transfers covered by
              that choice, including analytics linked to your account.
            </li>
            <li>
              <b>Advertising choices:</b> Outside the United States, advertising tracking and related transfers need your consent, even without a banner.
              In the United States they may start without consent where the law allows, subject to earlier refusals and recognised opt-out signals. Turning
              advertising off in Cookie Preferences stops browser tracking and the related transfers to advertising partners.
            </li>
            <li>
              <b>Product analytics:</b> Optional analytics that starts before consent can be switched off in Cookie Preferences. Where the law requires
              neither consent nor an opt-out, analytics needed to keep the product working may continue without a switch. That never covers sales or
              advertising uses. Data may stay linked to your browser or account; using an identifier does not make it anonymous. We honour every analytics
              choice we offer.
            </li>
          </ul>
        </div>
        <p>These settings don&apos;t limit any other rights described in our Privacy Policy. You can also block or delete cookies in your browser settings.</p>
        <div>
          <p className="font-semibold">What kinds of technologies do we use?</p>
          <p>We may use any or all of the following on the studio and in our emails:</p>
        </div>
        <div>
          <p className="font-semibold">Cookies:</p>
          <p>A cookie is a small text file saved by your browser or stored on your device. There are two kinds: &quot;session cookies&quot; and &quot;persistent cookies&quot;:</p>
          <p>• Session cookies disappear when you close your browser.</p>
          <p>• Persistent cookies stay on your device after you close your browser, until they expire or you delete them.</p>
        </div>
        <p>
          We and our providers may set first-party cookies on our own domain and third-party cookies on other domains. Whether consent or an opt-out is
          needed depends on what the information is used for and who receives it, not on which domain set the cookie.
        </p>
        <div>
          <p className="font-semibold">Local storage:</p>
          <p>
            The studio saves your projects, canvas, cast, reference vault and model registry in your browser&apos;s local storage so your work survives a
            reload. API keys you add are encrypted on your device before they are stored and are never sent to us.
          </p>
        </div>
        <div>
          <p className="font-semibold">Pixels and tags:</p>
          <p>
            Small pieces of code in pages or emails that tell us whether a page was viewed or an email was opened. We use them to measure campaigns and fix
            delivery problems.
          </p>
        </div>
        <div>
          <p className="font-semibold">Software development kits:</p>
          <p>
            Code from providers that helps us collect crash reports and performance data so we can keep the studio fast and stable.
          </p>
        </div>
        <div>
          <p className="font-semibold">Advertising partners</p>
          <p>
            Advertising partners may combine our information with their own to choose, deliver, improve and measure ads, as described in their privacy
            notices. They may act for their own purposes, not only on our behalf. These uses are separate from product analytics.
          </p>
        </div>
        <div>
          <p className="font-semibold">Why we use these technologies</p>
          <ul className="list-disc pl-6 mt-2 flex flex-col gap-2">
            <li>
              <b>To run the studio:</b> signing you in, saving projects between visits, keeping your canvas, timeline and vault in sync, and protecting
              accounts against misuse.
            </li>
            <li>
              <b>To remember your preferences:</b> the last studio you opened, panel sizes, timeline zoom, preferred models and routing mode.
            </li>
            <li>
              <b>To understand and improve the product:</b> which tools are used, where people get stuck, and how fast pages and renders load.
            </li>
            <li>
              <b>To measure our marketing:</b> whether an ad, newsletter or partner link led someone to try the studio.
            </li>
            <li>
              <b>To keep things secure:</b> spotting unusual sign-in patterns, automated abuse and attempts to misuse other people&apos;s credits.
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Connected platforms and API keys</p>
          <p>
            When you link outside platforms or model providers in Settings, the studio talks to them directly from your browser or through the local
            bridge you run on your own computer. Those services may set their own cookies or keep their own logs under their own policies. Keys and tokens
            you add are encrypted on your device and are only sent to the service they belong to.
          </p>
        </div>
        <div>
          <p className="font-semibold">Managing cookies in your browser</p>
          <p>
            Most browsers let you see, block and delete cookies. The controls usually live in the privacy or security section of the browser&apos;s
            settings. Blocking every cookie may stop the studio from working properly, and deleting local storage will remove projects you haven&apos;t
            exported. Export a project from the timeline before clearing browser data if you want to keep it.
          </p>
        </div>
        <div>
          <p className="font-semibold">Opt-out signals</p>
          <p>
            Where the law requires it, we treat a recognised browser opt-out signal, such as Global Privacy Control, as a request to opt out of
            advertising-related sharing for that browser. Because there is no common standard for &quot;Do Not Track&quot;, we don&apos;t respond to that
            signal, but you can make the same choice in Cookie Preferences.
          </p>
        </div>
        <div>
          <p className="font-semibold">Providers we work with</p>
          <p>Depending on your choices and where you live, the following kinds of providers may receive information through these technologies:</p>
          <ul className="list-disc pl-6 mt-3 flex flex-col gap-2">
            <li>
              <b>Hosting and delivery:</b> serve the studio&apos;s pages and files quickly and protect them against attacks. They see technical details such
              as your IP address and browser type.
            </li>
            <li>
              <b>Product analytics:</b> count page views and feature use so we can see which tools help and which get in the way. They may receive a device
              identifier and the pages you open.
            </li>
            <li>
              <b>Error monitoring:</b> collect crash reports and slow-loading warnings, including the page and action that failed, so we can fix problems.
            </li>
            <li>
              <b>Payments:</b> process subscriptions and credit top-ups and prevent fraud. They receive what they need to complete a payment.
            </li>
            <li>
              <b>Advertising networks:</b> measure whether an ad led to a sign-up or purchase and, where you allow it, show you relevant offers. They may
              receive identifiers, device and activity information and conversion events, and may use it for their own purposes as their privacy notices
              explain.
            </li>
            <li>
              <b>Email delivery:</b> send account and marketing emails and report whether they were delivered and opened.
            </li>
          </ul>
        </div>
      </section>
      <section className="mt-14">
        <h2 className="text-20 font-semibold">Details of Cookies and Similar Technologies</h2>
        <p className="mt-4">Below is a list of the cookies and similar technologies we use. We update it from time to time as the studio changes.</p>
        <div className="mt-6 flex flex-col gap-16">
          {CATS.map((c) => {
            const on = open.includes(c.t);
            return (
              <section key={c.t}>
                <div className="flex items-center justify-between">
                  <h3 className="text-20 font-semibold text-soft">{c.t}</h3>
                  <button onClick={() => setOpen(on ? open.filter((x) => x !== c.t) : [...open, c.t])} aria-expanded={on} className="text-lime flex items-center gap-2 pr-2">
                    Details <ChevronD size={14} className={on ? "rotate-180" : ""} />
                  </button>
                </div>
                <p className="mt-4 text-14 leading-5 text-[#d1d5dc]">{c.b}</p>
                {on && (
                  <table className="mt-4 w-full text-14 text-left">
                    <thead className="text-w50">
                      <tr>
                        <th className="py-1 font-medium">Name</th>
                        <th className="py-1 font-medium">Purpose</th>
                        <th className="py-1 font-medium">Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.rows.map((r) => (
                        <tr key={r[0]} className="border-t border-w10">
                          {r.map((x) => (
                            <td key={x} className="py-2 pr-3">
                              {x}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      </section>
      <section className="mt-14 flex flex-col gap-6">
        <p>Cookie expiry describes how long something is stored on your device. Information already collected may be kept separately, as set out in the retention section of our Privacy Policy.</p>
        <div>
          <p className="font-semibold">Changes to this Cookie Notice</p>
          <p>We may update the cookies and similar technologies we use from time to time, so please check this notice now and then for changes.</p>
        </div>
        <div>
          <p className="font-semibold">Questions</p>
          <p>
            If you have questions about this Cookie Notice, contact us through the <NextLink href="/" className="text-lime">help center</NextLink>.
          </p>
        </div>
      </section>
      <CookiePreferences open={prefs} onClose={() => setPrefs(false)} />
    </article>
  );
}
