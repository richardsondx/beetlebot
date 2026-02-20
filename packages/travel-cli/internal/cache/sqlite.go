package cache

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Entry struct {
	Key       string    `json:"key"`
	Data      []byte    `json:"data"`
	CreatedAt time.Time `json:"createdAt"`
	TTL       time.Duration `json:"-"`
}

// FileCache is a simple file-based cache for local installs.
// Using files instead of SQLite to minimize dependencies.
type FileCache struct {
	dir string
	mu  sync.RWMutex
}

func New() (*FileCache, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(home, ".cache", "beetlebot", "travel")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create cache dir: %w", err)
	}
	return &FileCache{dir: dir}, nil
}

func (c *FileCache) Get(key string, ttl time.Duration) ([]byte, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	path := c.path(key)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}

	var entry Entry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, false
	}

	if time.Since(entry.CreatedAt) > ttl {
		return nil, false
	}

	return entry.Data, true
}

func (c *FileCache) Set(key string, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := Entry{
		Key:       key,
		Data:      data,
		CreatedAt: time.Now().UTC(),
	}

	raw, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	return os.WriteFile(c.path(key), raw, 0o644)
}

func (c *FileCache) Clear() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		_ = os.Remove(filepath.Join(c.dir, e.Name()))
	}
	return nil
}

func (c *FileCache) path(key string) string {
	h := sha256.Sum256([]byte(key))
	return filepath.Join(c.dir, hex.EncodeToString(h[:])+".json")
}

func CacheKey(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte("|"))
	}
	return hex.EncodeToString(h.Sum(nil))
}
