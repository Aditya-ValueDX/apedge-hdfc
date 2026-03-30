import React from 'react';
import {
    ClipboardList,
    ShieldCheck,
    Scale,
    BadgeCheck,
    DollarSign,
    CreditCard,
    Landmark,
    Bot,
    Database,
    Settings,
    FileText,
    FilePen,
    UserCheck,
    Users,
    Send,
    CheckCircle,
    RotateCcw,
    Boxes,
    Building2,
    PackageCheck,
    Truck,
    Tag,
    BarChart2,
    Lock,
    Search,
    PenLine,
    Workflow,
} from 'lucide-react';

/**
 * WorkflowStepper
 *
 * Props:
 *  workflowConfig         – { steps: [{ stepId, stepName }] }
 *  currentWorkflowStepId  – stepId string of the currently active step
 *  isCompleted            – boolean: pass `true` when the workflow instance has finished
 *                           all steps (is_active = false in ap_process_workflow_instances).
 *                           When true every step renders as green ✓.
 *  completedStepStatuses  – { [stepId]: statusString } — map of stepId to the status
 *                           string that was set when the user transitioned away from that
 *                           step. Only populated for steps that have already been
 *                           completed; shown below the circle.
 */

/**
 * getStepIcon
 *
 * Dynamically maps a step name to a relevant Lucide icon component
 * using case-insensitive keyword matching.
 * Falls back to <Workflow /> if no keyword matches.
 *
 * @param {string} stepName
 * @returns {React.ComponentType} Lucide icon component
 */
const getStepIcon = (stepName = '') => {
    const name = stepName.toLowerCase();

    // ── Bot / automation / ERP / SAP ─────────────────────────────────────────
    if (/bot|automat|rpa/.test(name)) return Bot;
    if (/sap|erp/.test(name)) return Database;

    // ── Initiation / draft / start ───────────────────────────────────────────
    if (/initiat|start|begin|create|new|draft/.test(name)) return ClipboardList;

    // ── Submission / send ────────────────────────────────────────────────────
    if (/submit|send|dispatch/.test(name)) return Send;

    // ── Compliance / legal / regulatory ─────────────────────────────────────
    if (/compliance|legal|regulat/.test(name)) return ShieldCheck;
    if (/audit/.test(name)) return Scale;

    // ── Finance / payment / account / banking ───────────────────────────────
    if (/financ|payment|pay/.test(name)) return DollarSign;
    if (/account|banking|bank/.test(name)) return Landmark;
    if (/credit|card/.test(name)) return CreditCard;

    // ── Approval / review / verification ────────────────────────────────────
    if (/approv/.test(name)) return BadgeCheck;
    if (/review|verif|check/.test(name)) return UserCheck;
    if (/inspect|assess/.test(name)) return Search;

    // ── Document / form / entry ──────────────────────────────────────────────
    if (/document|form|entry|data/.test(name)) return FileText;
    if (/sign|edit|pen|writ/.test(name)) return FilePen;

    // ── User / manager / head ────────────────────────────────────────────────
    if (/manager|head|director|officer/.test(name)) return Users;
    if (/user|person|vendor|supplier/.test(name)) return UserCheck;

    // ── Onboard / register ───────────────────────────────────────────────────
    if (/onboard|register|enrol/.test(name)) return PackageCheck;

    // ── Inventory / warehouse / logistics ───────────────────────────────────
    if (/inventor|warehouse|stock/.test(name)) return Boxes;
    if (/logistic|ship|deliver|truck/.test(name)) return Truck;
    if (/purchas|procure|order/.test(name)) return Tag;

    // ── Report / analytics ───────────────────────────────────────────────────
    if (/report|analyt|stat|metric/.test(name)) return BarChart2;

    // ── Settings / config / setup ────────────────────────────────────────────
    if (/setting|config|setup/.test(name)) return Settings;

    // ── Lock / security / access ─────────────────────────────────────────────
    if (/secur|lock|access|auth/.test(name)) return Lock;

    // ── Retry / rework ───────────────────────────────────────────────────────
    if (/retry|rework|revert|redo/.test(name)) return RotateCcw;

    // ── Organisation / company / building ───────────────────────────────────
    if (/compan|organis|organ|building/.test(name)) return Building2;

    // ── Complete / close / end ───────────────────────────────────────────────
    if (/complet|close|end|finish/.test(name)) return CheckCircle;

    // ── Annotation / note / comment ─────────────────────────────────────────
    if (/note|comment|annot|remark/.test(name)) return PenLine;

    // ── Generic fallback ─────────────────────────────────────────────────────
    return Workflow;
};

const WorkflowStepper = ({
    workflowConfig,
    currentWorkflowStepId,
    isCompleted: allStepsCompleted = false,
    completedStepStatuses = {},
}) => {

    if (
        !workflowConfig ||
        !Array.isArray(workflowConfig.steps) ||
        workflowConfig.steps.length === 0
    ) {
        return null;
    }

    const steps = workflowConfig.steps;

    // All steps are green ✓ only when the caller explicitly signals completion
    // (is_active = false on the workflow instance — set by VendorEditor).
    const isAllApproved = allStepsCompleted;

    // ── Active step index ────────────────────────────────────────────────────
    const currentIndex = currentWorkflowStepId
        ? steps.findIndex((s) => s.stepId === currentWorkflowStepId)
        : 0;
    const activeIndex = currentIndex === -1 ? 0 : currentIndex;

    return (
        <div className="bg-white border-b border-gray-200 shadow-sm">
            {/*
              Two-layer scroll trick:
              • The outer div is a normal block — its width is the full component width.
              • The inner div uses `inline-flex` so it only grows as wide as its content
                (enabling the scroll when it overflows).
              • `text-center` on the outer + `inline-flex` on the inner naturally centres
                the stepper when it fits; when it overflows the outer scrolls.
            */}
            <div className="overflow-x-auto text-center px-4 mb-1">
                <div className="inline-flex items-center">
                    {steps.map((step, idx) => {
                        const isLast = idx === steps.length - 1;

                        // ── Per-step visual state ─────────────────────────────────
                        let isStepCompleted;
                        let isStepActive;

                        if (isAllApproved) {
                            isStepCompleted = true;
                            isStepActive = false;
                        } else {
                            isStepCompleted = idx < activeIndex;
                            isStepActive = idx === activeIndex;
                        }

                        // ── Circle classes ────────────────────────────────────────
                        let circleClasses;
                        if (isStepCompleted) {
                            circleClasses = 'bg-green-500 border-green-500 text-white';
                        } else if (isStepActive) {
                            circleClasses = 'bg-[#3B8FE5] border-[#3B8FE5] text-white';
                        } else {
                            circleClasses = 'bg-[#E8E8E8] border-[#E8E8E8] text-black';
                        }

                        // ── Label classes ─────────────────────────────────────────
                        let labelClasses;
                        if (isStepCompleted) {
                            labelClasses = 'text-green-600';
                        } else if (isStepActive) {
                            labelClasses = 'text-blue-600 font-semibold';
                        } else {
                            labelClasses = 'text-gray-400';
                        }

                        // ── Connector fill ────────────────────────────────────────
                        const connectorFilled = isAllApproved ? true : isStepCompleted;

                        // Circle diameter in px — must match w-6 h-6 (24px)
                        const CIRCLE_PX = 20;

                        // ── Dynamic icon for this step ────────────────────────────
                        // Resolved once per step; used in active & inactive circles.
                        // Icon size is kept at 9px to fit neatly inside the 15px circle.
                        const StepIcon = getStepIcon(step.stepName);
                        const ICON_PX = 10;

                        // ── Status label ──────────────────────────────────────────
                        // • Completed steps  → use completedStepStatuses (existing logic)
                        // • First step only, while still active → derive status from
                        //   the first transition's dataUpdates.status in the JSON.
                        //   This avoids any hardcoding — the value comes purely from
                        //   workflowConfig.steps[0].transitions[0].dataUpdates.status.
                        let stepStatus = null;
                        if (isStepCompleted && completedStepStatuses?.[step.stepId]) {
                            stepStatus = completedStepStatuses[step.stepId];
                        } else if (idx === 0 && isStepActive) {
                            const firstStepTransitions = step.transitions || [];
                            const firstTransition = firstStepTransitions[0];
                            stepStatus = firstTransition?.dataUpdates?.status ?? null;
                        }

                        return (
                            <React.Fragment key={`${step.stepId}-${idx}`}>
                                {/* ── Step node: stepName above circle, status below ── */}
                                <div className="flex flex-col items-center shrink-0">

                                    {/* Step name — centred above the circle */}
                                    <span
                                        className={`mb-1 text-[12px] font-medium text-center whitespace-nowrap leading-tight ${labelClasses}`}
                                        title={step.stepName}
                                    >
                                        {step.stepName}
                                    </span>

                                    {/* Circle */}
                                    {isStepActive ? (
                                        <div className="relative flex items-center justify-center" style={{ width: CIRCLE_PX, height: CIRCLE_PX }}>
                                            <span
                                                className="absolute inline-flex rounded-full bg-blue-400 opacity-30 animate-ping"
                                                style={{ width: CIRCLE_PX + 8, height: CIRCLE_PX + 8 }}
                                            />
                                            <div
                                                className={`relative flex items-center justify-center rounded-full border-2 transition-all duration-300 ${circleClasses}`}
                                                style={{ width: CIRCLE_PX, height: CIRCLE_PX }}
                                            >
                                                {/* Active step — show dynamic icon (white on blue) */}
                                                <StepIcon
                                                    size={ICON_PX}
                                                    strokeWidth={2.5}
                                                    aria-hidden="true"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`flex items-center justify-center rounded-full border-2 transition-all duration-300 ${circleClasses}`}
                                            style={{ width: CIRCLE_PX, height: CIRCLE_PX }}
                                        >
                                            {isStepCompleted ? (
                                                /* Completed step — keep existing green ✓ checkmark */
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                /* Upcoming step — show dynamic icon (dark on grey) */
                                                <StepIcon
                                                    size={ICON_PX}
                                                    strokeWidth={2.5}
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Status — shown below circle for completed steps and active first step */}
                                    <span
                                        className={`mt-1.5 text-[10px] font-medium text-center whitespace-nowrap leading-tight ${isStepCompleted ? 'text-green-600' : 'text-blue-600'}`}
                                        style={{ minHeight: 14 }}
                                    >
                                        {stepStatus || ''}
                                    </span>
                                </div>

                                {/* Connector line — directly touches the circle edge, hidden after last step */}
                                {!isLast && (
                                    /*
                                      mb aligns the line to the circle's vertical midpoint.
                                      Above circle: stepName label ≈ 10px font + 6px margin-bottom ≈ 16px
                                      Below circle: status label ≈ 10px font + 6px margin-top ≈ 16px
                                      So the connector sits at the midpoint of the whole node block,
                                      which is (status block height / 2) above the bottom = ~8px push up.
                                      We offset down by (bottom half of status area) = ~8px less than before.
                                    */
                                    <div
                                        className="shrink-0"
                                        style={{ width: 68, marginBottom: 14, marginLeft: 0, marginRight: 0 }}
                                    >
                                        <div className="relative h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${connectorFilled ? 'bg-green-500 w-full' : 'w-5'}`}
                                            />
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WorkflowStepper;