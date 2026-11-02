ALTER TABLE `shops` ADD `apps` json;--> statement-breakpoint
UPDATE `shops` SET `apps` = JSON_OBJECT('contact', JSON_OBJECT('whatsappOn', true, 'whatsapp', JSON_UNQUOTE(JSON_EXTRACT(`design`, '$.socials.whatsapp')))) WHERE JSON_EXTRACT(`design`, '$.floatingWhatsapp') = true AND JSON_UNQUOTE(JSON_EXTRACT(`design`, '$.socials.whatsapp')) <> '';
