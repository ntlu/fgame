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
