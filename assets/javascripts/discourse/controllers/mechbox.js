import Controller from "@ember/controller";

export default class MechboxController extends Controller {
  get apiPrefix() {
    return this.model.apiPrefix;
  }

  get analysisCategories() {
    return this.model.analysisCategories || [];
  }

  get singleToolDirectory() {
    return this.model.singleToolDirectory || [];
  }

  get futureInterfaces() {
    return this.model.futureInterfaces || [];
  }
}
