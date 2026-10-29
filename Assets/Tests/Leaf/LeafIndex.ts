import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {C1OpenRingsScenario} from "./C1OpenRingsScenario"
import {C2PinchMoveScenario} from "./C2PinchMoveScenario"
import {C3ReachAndJugScenario} from "./C3ReachAndJugScenario"
import {C4SuggestionScenario} from "./C4SuggestionScenario"
import {C5AskWhyScenario} from "./C5AskWhyScenario"
import {ReachIKScenario} from "./ReachIKScenario"
import {N1MarkProblemScenario} from "./N1MarkProblemScenario"

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
  ]
}
