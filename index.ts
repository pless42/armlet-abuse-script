
import { EventsSDK, EntityManager, LocalHero, Item, Modifier, Projectile, Animation } from "github.com/octarine-public/wrapper/index";

console.log("Armlet Abuse Script Loaded!");

// Настройки (можно добавить в меню Octarine, если API поддерживает)
const safeThreshold = 550; // HP для safe off
const dangerousThreshold = 100; // HP для emergency toggle
const abuseHPThreshold = 400; // HP для активации abuse на DoT
let lastTime = 0;
const msgQueue: number[] = []; // Queue для delayed toggles
let armlet: Item | undefined;

EventsSDK.on("GameStarted", () => {
    console.log("Game Started - Armlet Abuse Ready");
});

// Основной тик: Обработка queue и emergency low HP
EventsSDK.on("Tick", deltaTime => {
    const hero = LocalHero;
    if (!hero || !hero.IsAlive) return;

    // Находим армлет
    if (!armlet || !armlet.IsValid) {
        armlet = hero.GetItemByName("item_armlet");
        if (!armlet) return;
    }

    const currentTime = GameTime; // Предполагаем GameTime в API
    if (hero.Health < dangerousThreshold && currentTime - lastTime > 0.6) {
        toggleArmlet();
    }

    // Обработка queue
    if (msgQueue.length > 0) {
        const timestamp = msgQueue.shift()!;
        const err = 0.05;
        if (Math.abs(timestamp - currentTime) <= err) {
            armlet.Toggle();
            lastTime = currentTime;
        } else if (timestamp > currentTime + err) {
            msgQueue.unshift(timestamp); // Вернуть в queue
        }
    }
});

// Обработка orders (attack/move)
EventsSDK.on("PrepareUnitOrders", orders => {
    const hero = LocalHero;
    if (!hero || !armlet) return true;

    const currentTime = GameTime;
    if (!armlet.IsToggledOn && (orders.order === Enum.UnitOrder.DOTA_UNIT_ORDER_ATTACK_MOVE || orders.order === Enum.UnitOrder.DOTA_UNIT_ORDER_ATTACK_TARGET)) {
        // Skip для фарма, если опция off (адаптировать под меню)
        // if (!farmMode && orders.target && isCreep(orders.target)) return true;
        armlet.Toggle();
        lastTime = currentTime;
    }

    if (armlet.IsToggledOn && hero.Health >= safeThreshold && (orders.order === Enum.UnitOrder.DOTA_UNIT_ORDER_MOVE_TO_POSITION || orders.order === Enum.UnitOrder.DOTA_UNIT_ORDER_MOVE_TO_TARGET)) {
        armlet.Toggle();
        lastTime = currentTime;
    }
    return true;
});

// Обработка projectiles (ranged attacks)
EventsSDK.on("Projectile", projectile => {
    const hero = LocalHero;
    if (!hero || !armlet || !projectile || !projectile.source || !projectile.target || !projectile.isAttack || projectile.target !== hero || hero.IsSameTeam(projectile.source)) return;

    const trueDamage = projectile.source.GetTrueDamage() * hero.GetArmorDamageMultiplier(); // Адаптировать под API
    if (trueDamage + dangerousThreshold >= hero.Health && hero.Health > dangerousThreshold) {
        toggleArmlet();
    }
});

// Обработка animations (melee attacks)
EventsSDK.on("UnitAnimation", animation => {
    const hero = LocalHero;
    if (!hero || !armlet || !animation || !animation.unit || hero.IsSameTeam(animation.unit) || animation.unit.IsRanged() || !hero.IsEntityInRange(animation.unit, 150)) return;

    const trueDamage = animation.unit.GetTrueDamage() * hero.GetArmorDamageMultiplier();
    if (trueDamage + dangerousThreshold >= hero.Health && hero.Health > dangerousThreshold) {
        toggleArmlet();
    }
});

// Обработка создания modifiers (для DoT abuse, e.g. Urn)
EventsSDK.on("ModifierCreated", modifier => {
    const hero = LocalHero;
    if (!hero || !armlet || !modifier || modifier.Target !== hero || !modifier.IsDebuff) return;

    // Проверяем на DoT modifiers (добавьте больше, e.g. "modifier_urn_damage", "modifier_spirit_vessel_damage")
    if (modifier.Name === "modifier_urn_damage" || modifier.Name === "modifier_spirit_vessel_damage") {
        if (hero.Health >= abuseHPThreshold) return; // Только если HP < 400

        const remainingTime = modifier.RemainingTime; // Оставшееся время дебаффа
        const tickPeriod = 1; // Стандартный тик для Urn (1 сек, уточните в Dota патчах)
        const nextTickDelay = tickPeriod - (GameTime % tickPeriod) - 0.05; // Рассчитываем delay до следующего тика (с offset для accuracy)

        // Queue toggle перед тиком для dodge
        msgQueue.push(GameTime + nextTickDelay);
        console.log(`Abuse queued for ${modifier.Name} at delay ${nextTickDelay}`);
    }
});

// Функция toggle (с queue для on/off)
function toggleArmlet() {
    const hero = LocalHero;
    if (!hero || !armlet) return;

    const currentTime = GameTime;
    if (armlet.IsToggledOn) {
        msgQueue.push(currentTime);
        msgQueue.push(currentTime + 0.1); // Quick off-on для HP gain
    } else {
        msgQueue.push(currentTime);
    }
}