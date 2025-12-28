import { BrowserRouter, Routes, Route } from "react-router-dom";
import BoardsPage from "./pages/BoardsPage";
import BoardView from "./pages/BoardView";

function App() {
  return (
    <BrowserRouter>
      <Routes>
  <Route path="/" element={<BoardsPage />} />
  <Route path="/board/:id" element={<BoardView />} />
</Routes>

    </BrowserRouter>
  );
}

export default App;
