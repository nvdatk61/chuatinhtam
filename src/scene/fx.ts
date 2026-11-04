/**
 * Thời điểm (performance.now) của các hiệu ứng vừa xảy ra.
 * Dùng biến module thay vì state React để useFrame đọc trực tiếp, không gây re-render.
 */
export const fx = {
  bellAt: -1e9,
  moAt: -1e9,
  shakeAt: -1e9,
  bowAt: -1e9,
}

/** Vị trí hiện tại của người chơi local (để tính âm lượng âm thanh từ người khác) */
export const me = { x: 0, z: 11 }

/** Khung va chạm hình chữ nhật [minX, maxX, minZ, maxZ] */
export const COLLIDERS: Array<[number, number, number, number]> = [
  [-7.6, 7.6, -11.5, -10.6], // tường sau chánh điện
  [-7.6, -6.8, -11.5, -2.2], // tường trái
  [6.8, 7.6, -11.5, -2.2], // tường phải
  [-1.6, 1.6, -9.4, -7.9], // bệ thờ
  [-3.7, -2.7, -7.3, -6.5], // bàn mõ
  [8.1, 9.9, 2.1, 2.9], // gác chuông (khối treo chuông phía sau)
  [-9.6, -8.4, 2.6, 3.4], // bàn ống xăm
  [-14, -9.4, 7.5, 12.5], // hồ sen
  [-6.2, -3.8, 13.6, 14.4], // trụ cổng trái
  [3.8, 6.2, 13.6, 14.4], // trụ cổng phải
  [-0.75, 0.75, 2.75, 4.25], // lư hương giữa sân
  [-14.4, -13.6, 1.6, 2.4], // cây
  [13.6, 14.4, 8.6, 9.4], // cây
]

export const BOUNDS = { minX: -16, maxX: 16, minZ: -10.4, maxZ: 18 }

export function blocked(x: number, z: number, r = 0.35) {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true
  for (const [x0, x1, z0, z1] of COLLIDERS) {
    if (x + r > x0 && x - r < x1 && z + r > z0 && z - r < z1) return true
  }
  return false
}
