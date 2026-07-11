export default function () {
  this.route("mechbox", { path: "/mechbox" }, function () {
    this.route("index", { path: "/" });
    this.route("tool", { path: "/tools/:tool_id" });
  });
}
