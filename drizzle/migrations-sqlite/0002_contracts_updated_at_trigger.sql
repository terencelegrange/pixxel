CREATE TRIGGER trg_contracts_updated_at AFTER UPDATE ON contracts BEGIN
  UPDATE contracts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
