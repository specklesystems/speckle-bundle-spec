cmake_minimum_required(VERSION 3.14)

# The project version is the spec release (VERSIONING.md); hand-bumped, asserted by the
# conformance test against meta.schema_version.
project(bundlespec VERSION 1.4.0 LANGUAGES CXX)

add_library(bundlespec INTERFACE)
add_library(bundlespec::bundlespec ALIAS bundlespec)
target_include_directories(bundlespec INTERFACE
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)
target_compile_features(bundlespec INTERFACE cxx_std_17)

# project() scopes <name>_VERSION to this directory; FetchContent consumers read it from
# theirs, so lift it one level when we are a subdirectory.
if(NOT CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  set(bundlespec_VERSION ${PROJECT_VERSION} PARENT_SCOPE)
endif()

include(GNUInstallDirs)
install(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
