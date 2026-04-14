import React from "react";
import { GavelIcon } from "./Icons";

interface JudgeRubricPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const RUBRIC_ROWS = [
  { criterion: "PROBLEM", subtitle: "the pain was clearly described AND demonstrates a real problem worth addressing", excellent: "Pain point is exceptionally well-defined with compelling evidence showing a significant, urgent real-world problem worth solving.", veryGood: "Pain point is clearly described with good supporting evidence. Believable and relevant to the target customer.", good: "Pain point is adequately described with some evidence. Problem appears real but may lack depth.", average: "Pain point is vaguely described with minimal evidence. Problem may not seem urgent or significant.", poor: "Pain point is poorly articulated or unconvincing. Little to no evidence it's a real problem.", missing: "No problem statement is provided." },
  { criterion: "SOLUTION", subtitle: "the value proposition vis-à-vis the pain was clearly described, demonstrating significant value/benefit", excellent: "Value proposition is exceptionally clear and directly addresses the pain. Demonstrates significant, measurable value that would compel adoption.", veryGood: "Value proposition is clearly described and addresses the pain well. Problem-solution fit is logical and well-articulated.", good: "Value proposition is adequately described and relates to the pain. Connection could be stronger.", average: "Value proposition is vaguely described with weak connection to the pain. Solution's value is unclear.", poor: "Value proposition is poorly articulated or does not address the pain. Little clear value demonstrated.", missing: "No solution or value proposition is provided." },
  { criterion: "TARGET MARKET", subtitle: "a clearly defined target market segment was identified AND linked specifically to the described problem", excellent: "Specific, well-defined segment with exceptional detail (demographics, psychographics, behaviors) directly linked to the problem.", veryGood: "Clear target market with good detail. Well-linked to the problem and appears realistic.", good: "Target market identified with adequate detail. Link to the problem present but may lack specificity.", average: "Vague target market with minimal detail. Connection to the problem weak or unclear.", poor: "Poorly defined or unrealistic target market. Little to no connection to the problem.", missing: "No target market is identified." },
  { criterion: "COMPETITION", subtitle: "a clear, sustainable and obvious competitive advantage(s) was clearly demonstrated", excellent: "Competitive landscape thoroughly analyzed. Multiple clear, sustainable, defensible advantages with strong evidence.", veryGood: "Competitive landscape well-analyzed. Clear advantages identified that appear sustainable.", good: "Competitive landscape adequately addressed. Some advantages identified, though sustainability may be questionable.", average: "Competitive analysis is superficial. Advantages are vague or not clearly sustainable.", poor: "Poor or unrealistic competitive analysis. No clear advantages demonstrated.", missing: "No competitive analysis is provided." },
  { criterion: "BUSINESS MODEL", subtitle: "how the venture will make money was clearly described through a model with superior potential for profitability", excellent: "Revenue generation is exceptionally clear. Business model shows superior potential for profitability with logical assumptions.", veryGood: "Revenue generation clearly described. Business model is realistic with good profitability potential.", good: "Revenue generation adequately described. Business model present but may lack detail.", average: "Revenue generation vaguely described. Business model lacks clarity or realism.", poor: "Business model poorly articulated or unrealistic. Revenue generation unclear.", missing: "No business model is provided." },
  { criterion: "GO-TO-MARKET PLAN", subtitle: "a clear and logical path to market over a realistic timeframe was articulated", excellent: "Comprehensive, strategic go-to-market plan with exceptional detail. Path to market is logical, well-sequenced, and achievable.", veryGood: "Clear go-to-market plan with good detail. Path to market is logical and realistic.", good: "Basic go-to-market plan. Path to market outlined but may lack detail.", average: "Vague go-to-market plan. Path to market lacks clarity or realism.", poor: "Poorly developed or unrealistic go-to-market plan. Little clarity on reaching customers.", missing: "No go-to-market plan is provided." },
  { criterion: "FINANCIALS", subtitle: "a clear, 3–5 year financial projection was shown with key assumptions/metrics", excellent: "Comprehensive 3–5 year projections with exceptional clarity. Key assumptions are stated and realistic.", veryGood: "Clear 3–5 year projections. Key assumptions stated and appear realistic.", good: "Basic 3–5 year projections. Some assumptions stated, though detail may be limited.", average: "Vague or incomplete projections. Key assumptions missing or unclear.", poor: "Poorly developed or unrealistic projections. Critical assumptions missing.", missing: "No financial projections are provided." },
  { criterion: "TEAM", subtitle: "the team will succeed based on their bios/capabilities and the requirements to launch the venture", excellent: "Exceptional team composition, ideally suited to launch and scale. Bios show highly relevant experience. Gaps addressed with advisors.", veryGood: "Strong team well-suited to the venture. Bios show relevant experience and skills.", good: "Adequate team composition. Bios show some relevant experience, though gaps may exist.", average: "Weak or incomplete team. Bios show limited relevant experience.", poor: "Poor or highly incomplete team. Bios show little relevant experience.", missing: "No team information is provided." },
  { criterion: "PRESENTATION", subtitle: "the material was organized, thoughtfully developed and clearly presented in a professional, convincing manner", excellent: "Exceptionally well-organized, visually professional, and compelling. Delivery is polished and confident.", veryGood: "Well-organized and professional. Content clearly developed with good narrative flow.", good: "Adequately organized and reasonably professional. Delivery acceptable but may have minor issues.", average: "Poorly organized or lacks professionalism. Delivery has noticeable issues.", poor: "Disorganized or unprofessional. Delivery is weak or unclear.", missing: "No presentation is delivered." },
  { criterion: "Q & A RESPONSES", subtitle: "strong domain expertise and confidence strengthened the overall impression of their venture's potential", excellent: "Exceptional domain expertise demonstrated. Handles challenging questions with poise, significantly strengthening impression.", veryGood: "Strong domain expertise. Handles questions well with good poise.", good: "Adequate knowledge. Answers acceptable but may lack depth in some areas.", average: "Limited knowledge. Answers often vague or uncertain.", poor: "Poor knowledge or preparation. Answers unconvincing or evasive.", missing: "Team is unable or unwilling to respond to questions." },
];

const JudgeRubricPanel: React.FC<JudgeRubricPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="w-full max-w-4xl h-full bg-[#050509] border-l border-neutral-800 flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GavelIcon />
            <div>
              <h2 className="text-sm font-semibold text-neutral-50">Official Judge Rubric</h2>
              <p className="text-xs text-neutral-400">Used for the Stella Zhang New Venture Competition pitch judging.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="px-2.5 py-1.5 text-xs rounded-full border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50 transition">Close</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="border border-neutral-800 rounded-xl bg-neutral-900/80 overflow-x-auto">
            <table className="min-w-[960px] text-xs text-left border-collapse">
              <thead className="bg-neutral-950/90 sticky top-0 z-10 border-b border-neutral-800">
                <tr>
                  <th className="px-3 py-2 border-r border-neutral-800 text-neutral-200 font-semibold w-52">Criterion</th>
                  <th className="px-3 py-2 border-r border-neutral-800 text-emerald-300 font-semibold">Excellent (5)</th>
                  <th className="px-3 py-2 border-r border-neutral-800 text-blue-300 font-semibold">Very Good (4)</th>
                  <th className="px-3 py-2 border-r border-neutral-800 text-yellow-200 font-semibold">Good (3)</th>
                  <th className="px-3 py-2 border-r border-neutral-800 text-orange-200 font-semibold">Average (2)</th>
                  <th className="px-3 py-2 border-r border-neutral-800 text-red-200 font-semibold">Poor (1)</th>
                  <th className="px-3 py-2 text-neutral-300 font-semibold">Missing (0)</th>
                </tr>
              </thead>
              <tbody>
                {RUBRIC_ROWS.map((row, idx) => (
                  <tr key={row.criterion} className={idx % 2 === 0 ? "bg-neutral-900" : "bg-neutral-950/60"}>
                    <td className="align-top px-3 py-3 border-r border-neutral-800">
                      <p className="font-semibold text-neutral-100">{row.criterion}</p>
                      <p className="text-[11px] text-neutral-400 mt-1">{row.subtitle}</p>
                    </td>
                    <td className="align-top px-3 py-3 border-r border-neutral-800 text-neutral-200">{row.excellent}</td>
                    <td className="align-top px-3 py-3 border-r border-neutral-800 text-neutral-200">{row.veryGood}</td>
                    <td className="align-top px-3 py-3 border-r border-neutral-800 text-neutral-200">{row.good}</td>
                    <td className="align-top px-3 py-3 border-r border-neutral-800 text-neutral-200">{row.average}</td>
                    <td className="align-top px-3 py-3 border-r border-neutral-800 text-neutral-200">{row.poor}</td>
                    <td className="align-top px-3 py-3 text-neutral-200">{row.missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">Tip: Compare your pitch against these descriptions and aim to move each row from Average/Poor toward Very Good/Excellent.</p>
        </div>
      </aside>
    </div>
  );
};

export default JudgeRubricPanel;
