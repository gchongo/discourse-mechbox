import Controller from "@ember/controller";

export default class MechboxController extends Controller {
  get availableBuiltinTools() {
    return (this.model.metadata?.builtin_tools || []).filter((tool) => tool.available);
  }

  get designChains() {
    return this.model.metadata?.design_chains || [];
  }

  get analysisCategories() {
    return this.model.analysisCategories || [];
  }
}
