// SGEO v1 mesh encoder + CRC32 + SHA256 — port of Speckle.Objects SgeoEncoder.EncodeMesh /
// SgeoFormat. Navis geometry is meshes only (vertices + faces, no normals/uvs/colors).
// Header (16B LE): "SGEO" | ver=1 | type=0(Mesh) | flags u16 | units u16 | reserved u16 | crc32 u32.
// Body: u32 vertexCount(=verts/3) | u32 faceCount(=faces.size) | f64 verts[] | i32 faces[].
#pragma once
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace sgeo {

// Units.GetEncodingFromUnit (SDK) — short unit string → uint16 code.
inline uint16_t unitsCode(const std::string& u) {
  if (u == "mm") return 1;
  if (u == "cm") return 2;
  if (u == "m") return 3;
  if (u == "km") return 4;
  if (u == "in") return 5;
  if (u == "ft") return 6;
  if (u == "yd") return 7;
  if (u == "mi") return 8;
  return 0;
}

// Canonical CRC-32 (IEEE 802.3, reflected poly 0xEDB88320) over the SGEO body — the
// standard CRC-32 (matches zlib.crc32 / System.IO.Hashing.Crc32). The whole stack uses
// this same polynomial — the managed SDK (Speckle.Objects/Utils/SgeoFormat.cs `Crc32`,
// whose SgeoDecoder verifies it) and the Python encoder (specklepy bundle/sgeo.py) — so
// SGEO blobs stay byte-for-byte identical across producers and the geometry `id` (SHA256
// of the blob, CRC bytes included) matches. (This replaced an earlier non-standard
// 0xEDB88820 quirk, changed in lockstep across all three producers; no persisted v1
// blobs depended on the old value, so no SGEO version bump was needed.)
inline uint32_t crc32(const uint8_t* p, size_t n) {
  static uint32_t tbl[256];
  static bool init = false;
  if (!init) {
    for (uint32_t i = 0; i < 256; i++) {
      uint32_t c = i;
      for (int k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320u ^ (c >> 1) : c >> 1;
      tbl[i] = c;
    }
    init = true;
  }
  uint32_t crc = 0xFFFFFFFFu;
  for (size_t i = 0; i < n; i++) crc = tbl[(crc ^ p[i]) & 0xFF] ^ (crc >> 8);
  return crc ^ 0xFFFFFFFFu;
}

// ── SHA-256 (compact, public-domain style) → lowercase hex ──
struct Sha256 {
  uint32_t h[8];
  uint64_t len = 0;
  uint8_t buf[64];
  size_t bl = 0;
  Sha256() {
    static const uint32_t iv[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372,
                                   0xa54ff53a, 0x510e527f, 0x9b05688c,
                                   0x1f83d9ab, 0x5be0cd19};
    memcpy(h, iv, sizeof iv);
  }
  static uint32_t ror(uint32_t x, int n) { return (x >> n) | (x << (32 - n)); }
  void block(const uint8_t* p) {
    static const uint32_t K[64] = {
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
        0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
        0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
        0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
        0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2};
    uint32_t w[64];
    for (int i = 0; i < 16; i++)
      w[i] = (p[i * 4] << 24) | (p[i * 4 + 1] << 16) | (p[i * 4 + 2] << 8) |
             p[i * 4 + 3];
    for (int i = 16; i < 64; i++) {
      uint32_t s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >> 3),
               s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5],
             g = h[6], hh = h[7];
    for (int i = 0; i < 64; i++) {
      uint32_t S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25),
               ch = (e & f) ^ (~e & g), t1 = hh + S1 + ch + K[i] + w[i],
               S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22),
               maj = (a & b) ^ (a & c) ^ (b & c), t2 = S0 + maj;
      hh = g;
      g = f;
      f = e;
      e = d + t1;
      d = c;
      c = b;
      b = a;
      a = t1 + t2;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  void update(const uint8_t* p, size_t n) {
    len += n;
    while (n) {
      size_t k = 64 - bl;
      if (k > n) k = n;
      memcpy(buf + bl, p, k);
      bl += k;
      p += k;
      n -= k;
      if (bl == 64) {
        block(buf);
        bl = 0;
      }
    }
  }
  std::string hex() {
    uint64_t bits = len * 8;
    uint8_t pad = 0x80;
    update(&pad, 1);
    uint8_t z = 0;
    while (bl != 56) update(&z, 1);
    uint8_t lb[8];
    for (int i = 0; i < 8; i++) lb[i] = (uint8_t)(bits >> (56 - i * 8));
    update(lb, 8);
    static const char* hx = "0123456789abcdef";
    std::string out;
    out.reserve(64);
    for (int i = 0; i < 8; i++)
      for (int j = 3; j >= 0; j--) {
        uint8_t b = (uint8_t)(h[i] >> (j * 8));
        out += hx[b >> 4];
        out += hx[b & 0xF];
      }
    return out;
  }
};

inline std::string sha256hex(const uint8_t* p, size_t n) {
  Sha256 s;
  s.update(p, n);
  return s.hex();
}
inline std::string sha256hex(const std::string& s) {
  return sha256hex((const uint8_t*)s.data(), s.size());
}

// Encode a mesh (flat verts xyz, flat faces [3,i,j,k,...]) into an SGEO blob.
inline std::vector<uint8_t> encodeMesh(const std::vector<double>& verts,
                                       const std::vector<int32_t>& faces,
                                       uint16_t uc) {
  std::vector<uint8_t> body;
  body.reserve(8 + verts.size() * 8 + faces.size() * 4);
  auto u32 = [&](uint32_t v) {
    for (int i = 0; i < 4; i++) body.push_back((uint8_t)(v >> (8 * i)));
  };
  auto i32 = [&](int32_t v) {
    for (int i = 0; i < 4; i++) body.push_back((uint8_t)(v >> (8 * i)));
  };
  auto f64 = [&](double v) {
    uint64_t b;
    memcpy(&b, &v, 8);
    for (int i = 0; i < 8; i++) body.push_back((uint8_t)(b >> (8 * i)));
  };
  u32((uint32_t)(verts.size() / 3));
  u32((uint32_t)faces.size());
  for (double v : verts) f64(v);
  for (int32_t f : faces) i32(f);

  std::vector<uint8_t> buf(16 + body.size(), 0);
  buf[0] = 'S';
  buf[1] = 'G';
  buf[2] = 'E';
  buf[3] = 'O';
  buf[4] = 1;
  buf[5] = 0;  // magic, ver, type=Mesh
  buf[6] = 0;
  buf[7] = 0;  // flags=0 (no normals/uvs/colors)
  buf[8] = (uint8_t)(uc & 0xFF);
  buf[9] = (uint8_t)(uc >> 8);  // units
  buf[10] = 0;
  buf[11] = 0;  // reserved
  memcpy(buf.data() + 16, body.data(), body.size());
  uint32_t crc = crc32(body.data(), body.size());
  buf[12] = (uint8_t)(crc & 0xFF);
  buf[13] = (uint8_t)((crc >> 8) & 0xFF);
  buf[14] = (uint8_t)((crc >> 16) & 0xFF);
  buf[15] = (uint8_t)((crc >> 24) & 0xFF);
  return buf;
}

}  // namespace sgeo
