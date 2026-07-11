export default {
  resource: "application",
  path: "/",

  map() {
    this.route("mechbox", { path: "/mechbox" });
  },
};
