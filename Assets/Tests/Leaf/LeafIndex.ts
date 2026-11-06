import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {C1OpenRingsScenario} from "./C1OpenRingsScenario"
import {C2PinchMoveScenario} from "./C2PinchMoveScenario"
import {C3ReachAndJugScenario} from "./C3ReachAndJugScenario"
import {C4SuggestionScenario} from "./C4SuggestionScenario"
import {C5AskWhyScenario} from "./C5AskWhyScenario"
import {ReachIKScenario} from "./ReachIKScenario"
import {N1MarkProblemScenario} from "./N1MarkProblemScenario"
import {N2UpwardGoalScenario} from "./N2UpwardGoalScenario"
import {N3SequencePreviewScenario} from "./N3SequencePreviewScenario"
import {N4WhyWordingScenario} from "./N4WhyWordingScenario"
import {N5ControlRowInViewScenario} from "./N5ControlRowInViewScenario"
import {N6ViewModesScenario} from "./N6ViewModesScenario"
import {N7GroundViewpointScenario} from "./N7GroundViewpointScenario"
import {N8StickFigureScenario} from "./N8StickFigureScenario"
import {N9AutoViewScenario} from "./N9AutoViewScenario"
import {N10FootReachScenario} from "./N10FootReachScenario"
import {N11HeightScenario} from "./N11HeightScenario"
import {D1DemoAutopilotScenario} from "./D1DemoAutopilotScenario"
import {T1TopOutScenario} from "./T1TopOutScenario"
import {L1LabelSizesScenario} from "./L1LabelSizesScenario"
import {P1PinchBestLimbScenario} from "./P1PinchBestLimbScenario"
import {P2PinchOutOfReachScenario} from "./P2PinchOutOfReachScenario"
import {R8ArrowClearOfPanelScenario} from "./R8ArrowClearOfPanelScenario"
import {H1HiddenReadScenario} from "./H1HiddenReadScenario"
import {H2ShowMyBetaScenario} from "./H2ShowMyBetaScenario"
import {H3HintLadderScenario} from "./H3HintLadderScenario"
import {H4HintCueScenario} from "./H4HintCueScenario"
import {H5CameOffScenario} from "./H5CameOffScenario"
import {E1TagOwnBadgeScenario} from "./E1TagOwnBadgeScenario"
import {G1ControlCountScenario} from "./G1ControlCountScenario"
import {K1ResultCardScenario} from "./K1ResultCardScenario"
import {K2FallAgainPinnedScenario} from "./K2FallAgainPinnedScenario"
import {K3KeptScenario} from "./K3KeptScenario"
import {K4ReopenWriteScenario} from "./K4ReopenScenario"
import {K5ReopenReadScenario} from "./K5ReopenReadScenario"
import {V1VoiceScenario} from "./V1VoiceScenario"
import {X1CaptureScenario} from "./X1CaptureScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-open-rings", typename: C1OpenRingsScenario.getTypeName()},
    {id: "c2-pinch-move", typename: C2PinchMoveScenario.getTypeName()},
    {id: "c3-reach-and-jug", typename: C3ReachAndJugScenario.getTypeName()},
    {id: "c4-suggestion-label-arrow", typename: C4SuggestionScenario.getTypeName()},
    {id: "c5-ask-why", typename: C5AskWhyScenario.getTypeName()},
    {id: "extra-ik-reach-controls", typename: ReachIKScenario.getTypeName()},
    {id: "r1-mark-problem", typename: N1MarkProblemScenario.getTypeName()},
    {id: "r2-upward-goal", typename: N2UpwardGoalScenario.getTypeName()},
    {id: "r3-sequence-preview", typename: N3SequencePreviewScenario.getTypeName()},
    {id: "r4-why-wording", typename: N4WhyWordingScenario.getTypeName()},
    {id: "r5-control-row-in-view", typename: N5ControlRowInViewScenario.getTypeName()},
    {id: "r6-foot-reach", typename: N10FootReachScenario.getTypeName()},
    {id: "r7-height", typename: N11HeightScenario.getTypeName()},
    {id: "r8-arrow-clear-of-panel", typename: R8ArrowClearOfPanelScenario.getTypeName()},
    {id: "a1-view-modes", typename: N6ViewModesScenario.getTypeName()},
    {id: "a2-ground-scan-250", typename: N7GroundViewpointScenario.getTypeName()},
    {id: "a3-auto-view", typename: N9AutoViewScenario.getTypeName()},
    {id: "b1-stick-figure", typename: N8StickFigureScenario.getTypeName()},
    {id: "t1-top-out", typename: T1TopOutScenario.getTypeName()},
    {id: "l1-label-sizes", typename: L1LabelSizesScenario.getTypeName()},
    {id: "p1-pinch-best-limb", typename: P1PinchBestLimbScenario.getTypeName()},
    {id: "p2-pinch-out-of-reach", typename: P2PinchOutOfReachScenario.getTypeName()},
    {id: "h1-hidden-read", typename: H1HiddenReadScenario.getTypeName()},
    {id: "h2-show-my-beta", typename: H2ShowMyBetaScenario.getTypeName()},
    {id: "h3-hint-ladder", typename: H3HintLadderScenario.getTypeName()},
    {id: "h4-hint-cue", typename: H4HintCueScenario.getTypeName()},
    {id: "h5-came-off", typename: H5CameOffScenario.getTypeName()},
    {id: "e1-tag-own-badge", typename: E1TagOwnBadgeScenario.getTypeName()},
    {id: "g1-control-count", typename: G1ControlCountScenario.getTypeName()},
    {id: "k1-result-card", typename: K1ResultCardScenario.getTypeName()},
    {id: "k2-fall-again-pinned", typename: K2FallAgainPinnedScenario.getTypeName()},
    {id: "k3-kept", typename: K3KeptScenario.getTypeName()},
    {id: "k4-reopen-write", typename: K4ReopenWriteScenario.getTypeName()},
    {id: "k5-reopen-read", typename: K5ReopenReadScenario.getTypeName()},
    {id: "v1-voice", typename: V1VoiceScenario.getTypeName()},
    {id: "d1-demo-autopilot", typename: D1DemoAutopilotScenario.getTypeName()},
    // session 27: the screenshot driver for devpost/visual/v7_2, not a test (see X1CaptureScenario.ts)
    {id: "x1-capture", typename: X1CaptureScenario.getTypeName()},
  ]
}
