licenses(["notice"])

package(default_visibility = ["//java/arcs:__subpackages__"])

load("@io_bazel_rules_closure//closure:defs.bzl", "closure_js_library")
load("@com_google_j2cl//build_defs:rules.bzl", "j2cl_library")

j2cl_library(
    name = "impl",
    srcs = glob([
        "*.java",
    ]),
    deps = [
        "//java/arcs:dagger-j2cl",
        "//java/arcs:dagger_runtime-j2cl",
        "//java/arcs:javax_inject-j2cl",
        "//java/arcs/api:api-j2cl",
        "//java/arcs/crdt:crdt-j2cl",
        "//java/arcs/demo/services:services-j2cl",
        "//java/arcs/demo/particles:particles-j2cl",
        "@com_google_elemental2//:elemental2-core-j2cl",
        "@com_google_elemental2//:elemental2-promise-j2cl",
        "@com_google_elemental2//:elemental2-dom-j2cl",
        "@com_google_j2cl//:jsinterop-annotations-j2cl",
        "@com_google_jsinterop_base//:jsinterop-base-j2cl",
    ],
)
