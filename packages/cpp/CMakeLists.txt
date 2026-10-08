cmake_minimum_required(VERSION 3.14)

# The release tarball carries the tag in a VERSION file (VERSIONING.md); a checkout has
# none and reports 0.0.0, like every other package built outside a release.
if(EXISTS "${CMAKE_CURRENT_LIST_DIR}/VERSION")
  file(STRINGS "${CMAKE_CURRENT_LIST_DIR}/VERSION" BUNDLESPEC_VERSION LIMIT_COUNT 1)
else()
  set(BUNDLESPEC_VERSION 0.0.0)
endif()
project(bundlespec VERSION ${BUNDLESPEC_VERSION} LANGUAGES CXX)

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
