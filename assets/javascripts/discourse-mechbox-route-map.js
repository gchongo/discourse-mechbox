export default function () {
  this.route("mechbox", { path: "/mechbox" });
  this.route("mechbox-tool", { path: "/mechbox/tools/:tool_id" });
}
