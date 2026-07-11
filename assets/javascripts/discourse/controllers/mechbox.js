import Controller from "@ember/controller";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import I18n from "I18n";

export default class MechboxController extends Controller {
  @tracked metadata = null;
  @tracked categories = [];
  @tracked builtinTools = [];
  @tracked clientTools = [];
  @tracked selectedToolId = null;
  @tracked inputsJson = "{}";
  @tracked calculationResult = null;
  @tracked records = [];
  @tracked favoriteToolIds = [];
  @tracked isCalculating = false;
  @tracked isRefreshing = false;
  @tracked errorMessage = null;

  initializeFromModel(model) {
    this.metadata = model.metadata;
    this.categories = model.categories || [];
    this.builtinTools = model.builtinTools || [];
    this.clientTools = model.clientTools || [];
    this.records = model.records || [];
    this.favoriteToolIds = (model.favorites || []).map((favorite) => favorite.tool_id);
    this.selectedToolId = this.builtinTools[0]?.tool_id || null;
    this.inputsJson = "{}";
    this.calculationResult = null;
    this.errorMessage = null;
  }

  get selectedTool() {
    return this.builtinTools.find((tool) => tool.tool_id === this.selectedToolId);
  }

  get hasBuiltinTools() {
    return this.builtinTools.length > 0;
  }

  get saveRecordsEnabled() {
    return this.metadata?.settings?.save_calculation_records === true;
  }

  get defaultUnitSystem() {
    return this.metadata?.settings?.default_unit_system || "metric";
  }

  get calculationResultJson() {
    if (!this.calculationResult) {
      return "";
    }

    return JSON.stringify(this.calculationResult, null, 2);
  }

  isFavorited(toolId) {
    return this.favoriteToolIds.includes(toolId);
  }

  isSelectedTool(toolId) {
    return this.selectedToolId === toolId;
  }

  parseInputs() {
    const parsed = JSON.parse(this.inputsJson || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(I18n.t("mechbox.invalid_inputs_json"));
    }
    return parsed;
  }

  async refreshRecords() {
    const payload = await ajax("/mechbox/api/records", { data: { limit: 20 } });
    this.records = payload.records || [];
  }

  async refreshFavorites() {
    const payload = await ajax("/mechbox/api/favorites");
    this.favoriteToolIds = (payload || []).map((favorite) => favorite.tool_id);
  }

  @action
  selectTool(toolId) {
    this.selectedToolId = toolId;
    this.calculationResult = null;
    this.errorMessage = null;
  }

  @action
  updateInputs(event) {
    this.inputsJson = event.target.value;
  }

  @action
  async calculate() {
    if (!this.selectedToolId) {
      return;
    }

    this.isCalculating = true;
    this.errorMessage = null;

    try {
      const result = await ajax("/mechbox/api/calculate", {
        type: "POST",
        data: {
          tool_id: this.selectedToolId,
          inputs: this.parseInputs(),
          unit_system: this.defaultUnitSystem,
          save_record: this.saveRecordsEnabled,
          title: `${this.selectedTool?.name || this.selectedToolId} (${new Date().toISOString()})`,
        },
      });

      this.calculationResult = result;
      if (this.saveRecordsEnabled) {
        await this.refreshRecords();
      }
    } catch (error) {
      this.errorMessage = error?.jqXHR?.responseJSON?.errors?.[0] || error?.message;
    } finally {
      this.isCalculating = false;
    }
  }

  @action
  async toggleFavorite(toolId) {
    this.isRefreshing = true;
    this.errorMessage = null;

    try {
      if (this.isFavorited(toolId)) {
        await ajax(`/mechbox/api/favorites/${encodeURIComponent(toolId)}`, { type: "DELETE" });
      } else {
        await ajax("/mechbox/api/favorites", {
          type: "POST",
          data: { tool_id: toolId },
        });
      }
      await this.refreshFavorites();
    } catch (error) {
      this.errorMessage = error?.jqXHR?.responseJSON?.errors?.[0] || error?.message;
    } finally {
      this.isRefreshing = false;
    }
  }
}
