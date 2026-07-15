# Standalone build of the shared-package smoke test. Arrow comes from the environment:
#   cmake -S cpp/test -B build [-DArrow_DIR=... -DParquet_DIR=...]
#   cmake --build build && ctest --test-dir build
# CI uses this on Linux (apt Arrow) and Windows/MSVC (conda-forge libarrow).
cmake_minimum_required(VERSION 3.16)
project(speckle-bundle-cpp-smoke CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include("${CMAKE_CURRENT_SOURCE_DIR}/../../cmake/SpeckleBundleCpp.cmake")

find_package(Arrow REQUIRED)
find_package(Parquet REQUIRED)

add_executable(smoke smoke.cc)
target_link_libraries(smoke PRIVATE
    speckle::bundle_core speckle::bundle_writer speckle::bundle_reader)
# Prefer shared (CI package managers ship it); fall back to static.
if(TARGET Arrow::arrow_shared)
  target_link_libraries(smoke PRIVATE Arrow::arrow_shared Parquet::parquet_shared)
else()
  target_link_libraries(smoke PRIVATE Arrow::arrow_static Parquet::parquet_static)
endif()

enable_testing()
add_test(NAME smoke COMMAND smoke)
