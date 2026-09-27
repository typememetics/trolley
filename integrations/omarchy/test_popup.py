import unittest
from popup import origin_url, status_message


class ProtocolTests(unittest.TestCase):
    def test_origins(self):
        self.assertEqual(origin_url("https://game.example/"), "https://game.example")
        self.assertEqual(origin_url("http://localhost:3000"), "http://localhost:3000")
        for value in ["http://game.example", "file:///etc/passwd", "https://a@b", "https://a/path", "https://a?key=x", "https://a#x", "javascript:alert(1)"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                origin_url(value)

    def test_signed_out(self):
        self.assertIn("sign in", status_message({"authenticated": False})["label"])

    def test_ranked_and_unranked(self):
        state = {"authenticated": True, "elo": 1516, "rank": 123, "name": "Alice"}
        self.assertEqual(status_message(state)["label"], "Trolley · 1516 Elo · #123")
        state.update(elo=1500, rank=None)
        self.assertEqual(status_message(state)["label"], "Trolley · 1500 Elo · unranked")

    def test_bad_status_is_not_a_rating(self):
        for state in [{}, {"error": "Unavailable"}, {"authenticated": True, "elo": "1500", "rank": 1}, {"authenticated": True, "elo": 1500, "rank": 0}]:
            with self.subTest(state=state), self.assertRaises((ValueError, KeyError)):
                status_message(state)


if __name__ == "__main__":
    unittest.main()
