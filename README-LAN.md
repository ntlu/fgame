# Milestone 7A - LAN Multiplayer Foundation

Dự án đã được cấu trúc lại và hỗ trợ chạy Server bằng Node.js với Express và Socket.IO.

## Cấu trúc thư mục
- `/client/`: Chứa giao diện (Frontend) và logic View (`Renderer.js`, `UIState.js`).
- `/server/`: Chứa Server Node.js (Backend) và `GameStateStore`.
- `/shared/`: Chứa Core Logic (`GameState.js`, `RuleEngine.js`, `TurnEngine.js`...) dùng chung cho cả Client và Server.

## Kiến trúc Server Authoritative
```
Client (View Only)
   ↓ requestGameState / resetGame
Socket.IO
   ↓ 
Server (GameStateStore)
   ↓ 
Shared GameState (Nguồn dữ liệu duy nhất)
   ↓ broadcastGameState
Socket.IO
   ↓ 
Client (Cập nhật currentGameState = structuredClone(serverState) và Render)
```

## Gameplay Flow (Milestone 7C)
```
Client
   ↓ playTurn (selectedHandCardId, selectedTableCardId)
Server
   ↓ TurnEngine.processPlay(), processDraw(), nextTurn()
GameStateStore (Lưu log, tính điểm nếu ván kết thúc)
   ↓ broadcastGameState
Tất cả Clients (Xóa lựa chọn cũ, cập nhật UI và hiển thị Server Log)
```
*(Lưu ý: Client không còn sở hữu GameState cục bộ, mọi dữ liệu bài đều phải đến từ Server).*

## Tính năng mới ổn định Multiplayer (Milestone 7C.5)

### 1. Turn Lock
- Khi Client gửi request `playTurn`, Server áp dụng cơ chế khóa turn (`processingTurn = true`).
- Mọi request `playTurn` gửi lên trong khi Server đang xử lý sẽ bị từ chối (trả về `false`) để ngăn chặn spam từ client (nhấp đúp hoặc nhấp liên tiếp nhiều lần trong tích tắc).
- Giúp bảo vệ tính toàn vẹn của ván đấu, tránh tình trạng double-turn hoặc crash Server.

### 2. State Version
- Server quản lý trường `gameState.version` (khởi tạo bằng `1`).
- Mỗi khi `processTurn()` thành công hoặc khi `resetGame()` được gọi, `version` trên Server sẽ tăng lên 1.
- Client hoàn toàn không tự ý thay đổi hoặc tự tạo version mới mà luôn lấy trực tiếp từ trường `version` trong `gameStateUpdate` được gửi từ Server.
- Đồng bộ hóa tuyệt đối trạng thái trên tất cả các Client kết nối.

### 3. Log Limit & Helper
- Nhật ký game (`logs`) được giới hạn tối đa **50 dòng** gần nhất, tự động xóa dòng cũ nhất khi vượt quá giới hạn này để tránh rò rỉ bộ nhớ.
- Tất cả log mới bắt buộc phải đi qua helper `addLog()` trên Server nhằm đồng bộ và quản lý dễ dàng hơn.

## Tính năng mới: Quản lý ghế & Quyền sở hữu người chơi (Milestone 7D)

### 1. Join Game & Gán ghế tự động
- Khi truy cập game, người chơi mặc định là Spectator (người xem).
- Click nút **Join Game** trong bảng Connection Panel để tham gia vào ghế trống đầu tiên (`Player 1` đến `Player 4`).
- Nếu game đã đủ 4 người, người thứ 5 click **Join Game** sẽ nhận thông báo lỗi "Game Full" và tiếp tục làm Spectator.
- Khi người chơi ngắt kết nối (Disconnect), Server tự động giải phóng ghế trống để người khác có thể tham gia.

### 2. Player Ownership (Quyền sở hữu bài)
- Mỗi client đã join game sẽ chỉ được hiển thị mặt trước bài của chính mình.
- Bài của các người chơi khác sẽ được hiển thị dạng úp mặt sau (🂠) để đảm bảo tính công bằng và bảo mật thông tin bài.
- Spectator sẽ thấy tất cả bài của người chơi khác đều úp.

### 3. Turn Validation (Xác thực lượt đánh)
- Client chỉ hiển thị nút **Đánh bài** và cho phép tương tác bài khi tới lượt chơi của mình. Nếu không đúng lượt, nút đánh bài sẽ bị vô hiệu hóa kèm nhãn hiển thị **Not Your Turn**.
- Server sẽ thực hiện kiểm tra chéo (`socket.id` -> `playerAssignments` -> `playerIndex` và so sánh với `currentPlayerIndex`). Mọi hành vi cố tình gửi gói tin lượt đánh từ client không đúng lượt sẽ bị Server từ chối xử lý.

## Đăng nhập & Chọn Chế Độ (Milestone 8.0 & 8.5)

Trò chơi áp dụng cơ chế xác thực đơn giản để hỗ trợ cho việc quản lý phòng và các tính năng AI, Offline.

### Login Flow
1. **Mở game**: Người chơi sẽ luôn thấy màn hình Login đầu tiên nếu chưa đăng nhập.
2. **Nhập mã (Access Code)**: Tương ứng với danh sách mã cứng bên dưới.
3. **Chọn chế độ (Game Mode Screen)**: 
   - Sau khi login thành công, UI sẽ chuyển sang màn hình Chọn chế độ.
   - Các chế độ đang mở:
     - **Online 4 Người**: Chế độ chơi qua mạng LAN bằng Socket.IO (5 lá/người).
     - **Offline 2 Người (User vs AI)**: Chế độ chơi local không cần mạng, đấu với AI cơ bản (10 lá/người, mốc x2 là 145 điểm). AI ưu tiên ăn bài, nếu không có thì đánh ngẫu nhiên.
4. **Vào Lobby / Game**: Khi ấn chọn chế độ, Client sẽ khởi tạo môi trường tương ứng (Socket.IO hoặc OfflineGameStore).

### Danh sách Access Code (Hardcode)
- Mã `111` -> Người dùng: **NV1**
- Mã `222` -> Người dùng: **NV2**
- Mã `333` -> Người dùng: **NV3**
- Mã `444` -> Người dùng: **NV4**

### Ngăn chặn đăng nhập trùng
Server tự động quản lý danh sách `activeUsers`. Nếu phát hiện NV1 đã đăng nhập và đang kết nối trên một trình duyệt khác, trình duyệt sau cố gắng kết nối bằng NV1 sẽ bị Server từ chối kèm thông báo: *"Tài khoản đang được sử dụng"*. Trạng thái login lưu tại `localStorage` để tự động vào Game Mode Screen ở lần tải trang sau.

## Hướng dẫn chạy thử nghiệm mạng LAN

### Bước 1: Cài đặt dependencies
Mở terminal tại thư mục gốc của project (nơi có file `package.json`) và chạy lệnh sau để tải các thư viện cần thiết:
```bash
npm install
# hoặc nếu dùng yarn:
yarn install
```

### Bước 2: Khởi động Server
Cũng tại thư mục gốc, chạy lệnh:
```bash
npm start
# hoặc:
yarn start
```
Nếu thành công, server sẽ in ra thông tin cổng và địa chỉ IP LAN, ví dụ:
```
--- Server Running ---
Local: http://localhost:3000
LAN:   http://192.168.1.50:3000
Use the LAN URL on mobile devices connected to the same WiFi.
----------------------
```

### Bước 3: Truy cập Client
- **Trên máy tính (Laptop/PC) đang chạy server**: Mở trình duyệt và truy cập `http://localhost:3000`
- **Trên điện thoại/tablet (cùng mạng WiFi)**: Truy cập vào địa chỉ LAN hiển thị ở màn hình console (Ví dụ `http://192.168.1.50:3000`)

### Bước 4: Kiểm tra kết nối và State Sync (Milestone 7B)
Khi bạn mở game trên các thiết bị, quan sát bảng **Connection Panel** ở góc trên bên phải màn hình:
- **Server**: sẽ hiện `Connected`.
- **Socket ID**: chuỗi ID đặc trưng cho mỗi kết nối.
- **Clients**: số lượng thiết bị đang truy cập vào game.
- **Last Sync**: Thời gian cập nhật GameState mới nhất từ server.

**Kiểm tra đồng bộ:**
1. Mở màn hình game trên 1 Laptop và 1 hoặc 2 điện thoại cùng lúc.
2. Tất cả sẽ hiển thị cùng một ván bài y hệt nhau vì **Server đã nắm quyền chia bài và phát state chung**.
3. Bấm nút **Reset Game** trên bất kỳ thiết bị nào (ví dụ trên Laptop).
4. Ngay lập tức, tất cả các thiết bị khác (điện thoại) sẽ tự động cập nhật bài mới trên tay và trên bàn **mà không cần reload trang**.

Mở DevTools Console (F12) bạn sẽ thấy log: `GameState Received` (được Server đẩy về liên tục mỗi 10 giây).

*(Lưu ý: Bạn chưa thể click đánh bài và thấy người khác cập nhật vì chức năng PlayCard qua mạng sẽ nằm ở Milestone 7C).*

## Development Testing

Để hỗ trợ phát triển và chạy các script kiểm thử tự động (tests):
- **Môi trường Production (Người chơi)**: Sử dụng file `index.html`. Môi trường này sẽ không tải các file script kiểm thử (`tests.js`, `tests-turn.js`), giúp tối ưu hóa tốc độ tải trang và tránh in các log kiểm thử ra console.
- **Môi trường Development (Lập trình viên)**: Truy cập vào địa chỉ `http://localhost:3000/index.dev.html`. File này sẽ tự động tải các kịch bản kiểm thử và hiển thị các log kết quả `PASS`/`FAIL` ra console của trình duyệt.

## Luật chơi: Lá bài Bí Mật (Secret Card Advantage System)

Để tăng tính chiến thuật và yếu tố bất ngờ cho game, trò chơi bổ sung thêm cơ chế **Lá bài Bí Mật**:

1. **Giai đoạn Setup (Deal Logic):**
   - Sau khi chia đủ 5 lá cho 4 người và lật 12 lá lên bàn chơi, lá bài tiếp theo của bộ bài (lá thứ 33) sẽ được rút ra làm **Secret Card**.
   - Lá bài này không được đưa vào Que ngay mà được ghi nhận bí mật, sau đó đưa xuống dưới đáy Que (vị trí cuối cùng để rút).
   
2. **Quyền sở hữu (Secret Card Owner):**
   - Người chơi cuối cùng nhận được bài khi chia (mặc định là Player 4 - index 3) sẽ có quyền sở hữu lá bài này.
   - Chỉ duy nhất Player 4 nhận được thông tin lá bài thật từ server và được xem riêng bài (thao tác click vào ô Bí Mật trong tay bài để lật lên/úp xuống). Các người chơi khác chỉ thấy mặt sau lá bài Bí Mật của Player 4 và không thể xem.

3. **Cơ chế tính điểm & Thanh toán (Settlement):**
   - Lá bài Bí Mật chỉ được lật công khai cho toàn bộ người chơi khi ván đấu kết thúc.
   - Nếu lá bài bí mật là **bài Đỏ (Cơ ♥ hoặc Rô ♦)**, chủ sở hữu sẽ được thưởng thêm số điểm tương ứng:
     - Lá `A` đỏ: +20 điểm.
     - Các lá `9`, `10`, `J`, `Q`, `K` đỏ: +10 điểm.
     - Các lá `2` đến `8` đỏ: + số điểm bằng giá trị số trên lá (ví dụ: `5♥` = +5 điểm).
   - Nếu là **bài Đen (Bích ♠ hoặc Nhép ♣)**: Không được cộng điểm thưởng (+0 điểm).
   - Điểm thưởng này sẽ được cộng trực tiếp vào tổng điểm của chủ sở hữu trước khi kiểm tra điều kiện nhân đôi điểm (X2) của ván đấu.
   - Quy trình thanh toán chuyển tiền là zero-sum: Chủ sở hữu nhận được `Điểm thưởng * 3` và mỗi người chơi khác bị trừ đi số điểm bằng đúng `Điểm thưởng`. Điểm thanh toán này cũng sẽ nhân đôi nếu ván đấu kích hoạt X2.

## Giao dịch và Tiền ảo (Virtual Bankroll System - Milestone 7F.5)

Trò chơi tích hợp hệ thống số dư tiền ảo để tăng tính thực tế khi chơi qua mạng LAN mà không yêu cầu cơ sở dữ liệu hay đăng nhập phức tạp:

1. **Khởi tạo số dư:**
   - Mỗi người chơi khi tham gia (Join) sẽ được cấp số dư khởi điểm là **10.000.000 VNĐ** (Money).
   - Số dư này tồn tại trong bộ nhớ RAM của Server và chỉ duy trì trong phiên chơi hiện tại. Khi khởi động lại Server (Server Restart), toàn bộ số dư sẽ khôi phục về mặc định 10.000.000 VNĐ.

2. **Quy đổi điểm và Thanh toán:**
   - Tỷ giá quy đổi: **1 điểm chung cuộc = 1.000 VNĐ**.
   - Cuối mỗi ván đấu, sau khi tính toán Settlement (điểm chung cuộc bao gồm cả Thưởng Lá bài Bí mật và nhân đôi X2 nếu có), số tiền thắng/thua được tính như sau:
     - `moneyChange = Settlement * 1000`
     - Số dư của người chơi tự động tăng/giảm: `money += moneyChange`.
   - Cơ chế thanh toán hoàn toàn là zero-sum: tổng số tiền biến động (`moneyChange`) của toàn bộ 4 người chơi luôn bằng đúng 0 VNĐ.

3. **Luật nhân đôi (X2 Double):**
   - Nếu có bất kỳ người chơi nào đạt từ **90 điểm trở lên** (tổng điểm bài ăn + điểm thưởng lá bài bí mật), ván đấu sẽ kích hoạt chế độ **X2**.
   - Khi đó, cả điểm thanh toán (Settlement) và số tiền biến động (Money) đều sẽ được nhân đôi.

4. **Bảo toàn số dư:**
   - Khi chủ phòng bấm **Reset Game** để bắt đầu vòng chơi tiếp theo, toàn bộ bài và điểm số của ván cũ sẽ bị xóa, nhưng số dư tiền ảo (Bankroll) của người chơi vẫn được giữ nguyên và cộng dồn liên tục qua các ván đấu.
