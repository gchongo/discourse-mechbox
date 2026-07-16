import Controller from "@ember/controller";

export default class MechboxController extends Controller {
  queryParams = ["tool_id"];
  tool_id = null;
}
