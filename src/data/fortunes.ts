/**
 * Lời xăm tự soạn, mang tính khích lệ – không phải lời tiên tri.
 * Có thể thay bằng bộ xăm của bạn.
 */
export interface Fortune {
  level: 'Thượng' | 'Trung' | 'Bình'
  title: string
  verse: string
  advice: string
}

export const FORTUNES: Fortune[] = [
  { level: 'Thượng', title: 'Trăng rằm soi nước', verse: 'Mây tan trăng hiện giữa trời,\nLòng thanh việc tỏ, đúng thời thì nên.', advice: 'Việc đang chờ sẽ sáng tỏ. Cứ kiên nhẫn, giữ lòng ngay thẳng.' },
  { level: 'Trung', title: 'Thuyền chờ gió thuận', verse: 'Bến xưa thuyền vẫn đợi chờ,\nGió về đúng lúc, chớ vờ vội đi.', advice: 'Chưa phải lúc hành động lớn. Chuẩn bị kỹ, cơ hội sẽ đến.' },
  { level: 'Thượng', title: 'Sen nở trong bùn', verse: 'Bùn sâu sen vẫn ngát hương,\nKhó khăn rèn chí, con đường thênh thang.', advice: 'Hoàn cảnh khó là nơi bạn trưởng thành. Đừng nản.' },
  { level: 'Bình', title: 'Lá rơi về cội', verse: 'Lá rơi về cội mùa thu,\nNhớ nguồn nhớ gốc, an cư lạc lòng.', advice: 'Dành thời gian cho gia đình. Một cuộc gọi về nhà hôm nay sẽ tốt.' },
  { level: 'Trung', title: 'Giọt nước mòn đá', verse: 'Nước kia nhỏ giọt ngày đêm,\nĐá dày cũng thủng, chớ quên bền lòng.', advice: 'Thành công đến từ việc nhỏ làm đều đặn mỗi ngày.' },
  { level: 'Thượng', title: 'Chim về tổ ấm', verse: 'Chiều buông chim gọi bạn về,\nNgười hiền gặp được, chẳng hề cô đơn.', advice: 'Quý nhân đang ở gần. Hãy mở lòng kết nối.' },
  { level: 'Bình', title: 'Mưa chiều qua phố', verse: 'Mưa chiều rồi cũng sẽ tan,\nNắng mai lại đến, ngập tràn niềm vui.', advice: 'Chuyện buồn chỉ là tạm thời. Nghỉ ngơi, ngủ đủ giấc.' },
  { level: 'Trung', title: 'Gieo hạt mùa xuân', verse: 'Xuân gieo hạt, hạ thấy mầm,\nThu về gặt lúa, việc tâm chẳng phiền.', advice: 'Đây là lúc gieo hạt: học thêm một kỹ năng mới.' },
  { level: 'Thượng', title: 'Đèn sáng đêm dài', verse: 'Một ngọn đèn giữa đêm thâu,\nSoi đường người lạc, phúc sâu tự thành.', advice: 'Giúp đỡ ai đó hôm nay, bạn sẽ thấy lòng nhẹ nhõm.' },
  { level: 'Bình', title: 'Núi cao mây phủ', verse: 'Núi cao mây phủ lưng chừng,\nĐi chậm mà chắc, chớ ngừng bước chân.', advice: 'Mục tiêu còn xa. Chia nhỏ ra và đi từng bước.' },
  { level: 'Trung', title: 'Gương trong tự soi', verse: 'Lau gương thấy rõ mặt mình,\nSửa mình trước đã, sự tình sẽ yên.', advice: 'Nhìn lại bản thân trước khi trách người khác.' },
  { level: 'Thượng', title: 'Hoa mai đón Tết', verse: 'Mai vàng khoe sắc đầu xuân,\nTâm an vạn sự, phúc lần lần sang.', advice: 'Một khởi đầu tốt đang tới. Hãy sẵn sàng đón nhận.' },
]
