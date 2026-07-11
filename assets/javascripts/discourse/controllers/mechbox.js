import Controller from "@ember/controller";

export default class MechboxController extends Controller {
  get apiPrefix() {
    return this.model.apiPrefix;
  }

  get futureInterfaces() {
    return this.model.futureInterfaces || [];
  }
}
