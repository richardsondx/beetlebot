package cache

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestFileCache_SetAndGet(t *testing.T) {
	dir := filepath.Join(os.TempDir(), "travel-test-cache")
	os.MkdirAll(dir, 0o755)
	defer os.RemoveAll(dir)

	c := &FileCache{dir: dir}

	err := c.Set("test-key", []byte(`{"hello":"world"}`))
	if err != nil {
		t.Fatalf("set failed: %v", err)
	}

	data, ok := c.Get("test-key", 5*time.Minute)
	if !ok {
		t.Fatal("expected cache hit")
	}
	if string(data) != `{"hello":"world"}` {
		t.Errorf("unexpected data: %s", string(data))
	}
}

func TestFileCache_Expiry(t *testing.T) {
	dir := filepath.Join(os.TempDir(), "travel-test-cache-exp")
	os.MkdirAll(dir, 0o755)
	defer os.RemoveAll(dir)

	c := &FileCache{dir: dir}

	_ = c.Set("expire-key", []byte(`data`))

	_, ok := c.Get("expire-key", 0)
	if ok {
		t.Error("expected cache miss due to zero TTL")
	}
}

func TestFileCache_Clear(t *testing.T) {
	dir := filepath.Join(os.TempDir(), "travel-test-cache-clr")
	os.MkdirAll(dir, 0o755)
	defer os.RemoveAll(dir)

	c := &FileCache{dir: dir}
	_ = c.Set("k1", []byte("v1"))
	_ = c.Set("k2", []byte("v2"))

	err := c.Clear()
	if err != nil {
		t.Fatalf("clear failed: %v", err)
	}

	_, ok1 := c.Get("k1", 5*time.Minute)
	_, ok2 := c.Get("k2", 5*time.Minute)
	if ok1 || ok2 {
		t.Error("expected all keys cleared")
	}
}

func TestCacheKey_Deterministic(t *testing.T) {
	k1 := CacheKey("flights", "YUL", "CDG", "2026-06-12")
	k2 := CacheKey("flights", "YUL", "CDG", "2026-06-12")
	if k1 != k2 {
		t.Error("cache keys should be deterministic")
	}

	k3 := CacheKey("flights", "YUL", "CDG", "2026-06-13")
	if k1 == k3 {
		t.Error("different inputs should produce different keys")
	}
}
