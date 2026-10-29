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
    {id: "a1-view-modes", typename: N6ViewModesScenario.getTypeName()},
    {id: "a2-ground-scan-250", typename: N7GroundViewpointScenario.getTypeName()},
    {id: "a3-auto-view", typename: N9AutoViewScenario.getTypeName()},
    {id: "b1-stick-figure", typename: N8StickFigureScenario.getTypeName()},
  ]
}
