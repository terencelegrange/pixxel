CREATE TRIGGER trg_users_updated_at AFTER UPDATE ON users BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_departments_updated_at AFTER UPDATE ON departments BEGIN
  UPDATE departments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_assets_updated_at AFTER UPDATE ON assets BEGIN
  UPDATE assets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_tiers_updated_at AFTER UPDATE ON tiers BEGIN
  UPDATE tiers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_asset_strategies_updated_at AFTER UPDATE ON asset_strategies BEGIN
  UPDATE asset_strategies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_domains_updated_at AFTER UPDATE ON domains BEGIN
  UPDATE domains SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_vendors_updated_at AFTER UPDATE ON vendors BEGIN
  UPDATE vendors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_roles_updated_at AFTER UPDATE ON roles BEGIN
  UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_projects_updated_at AFTER UPDATE ON projects BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_diagrams_updated_at AFTER UPDATE ON diagrams BEGIN
  UPDATE diagrams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_diagram_types_updated_at AFTER UPDATE ON diagram_types BEGIN
  UPDATE diagram_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_asset_complexities_updated_at AFTER UPDATE ON asset_complexities BEGIN
  UPDATE asset_complexities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_industry_sectors_updated_at AFTER UPDATE ON industry_sectors BEGIN
  UPDATE industry_sectors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_business_capabilities_updated_at AFTER UPDATE ON business_capabilities BEGIN
  UPDATE business_capabilities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_changelog_updated_at AFTER UPDATE ON changelog BEGIN
  UPDATE changelog SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_plantuml_diagrams_updated_at AFTER UPDATE ON plantuml_diagrams BEGIN
  UPDATE plantuml_diagrams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_investment_classifications_updated_at AFTER UPDATE ON investment_classifications BEGIN
  UPDATE investment_classifications SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_asset_roadmap_phases_updated_at AFTER UPDATE ON asset_roadmap_phases BEGIN
  UPDATE asset_roadmap_phases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_asset_dependencies_updated_at AFTER UPDATE ON asset_dependencies BEGIN
  UPDATE asset_dependencies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_app_settings_updated_at AFTER UPDATE ON app_settings BEGIN
  UPDATE app_settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;
