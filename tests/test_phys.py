# -*- coding: utf-8 -*-
"""Проверка расчётного ядра site/assets/phys.js.

phys.js — единственное место, где живут формулы разобранных задач (p-*.html)
и моделей виртуальных работ. Разбор HTML такую ошибку не поймает: страница
останется валидной, а ответ станет неверным.

Проверка идёт тремя независимыми путями:
  * встроенная самопроверка PHYS.selftest() — контрольные точки, которые
    проверяются физическими соображениями, а не сверкой с ответом
    (сохранение импульса, предельные случаи, обратимость формул);
  * пересчёт ключевых величин на Python по формулам, выписанным здесь заново
    из задачников (Иродов, Чертов, Трофимова), — опечатка в JS не может
    подтвердить сама себя;
  * структурные проверки: модуль чистый (не трогает DOM) и его постоянные
    совпадают со справочником сайта.
"""
import json
import math
import os
import re
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHYS_JS = os.path.join(ROOT, 'site', 'assets', 'phys.js')
SITE = os.path.join(ROOT, 'site')

pytestmark = [
    pytest.mark.skipif(not os.path.isfile(PHYS_JS), reason='нет site/assets/phys.js'),
    pytest.mark.skipif(not shutil.which('node'), reason='node не установлен'),
]

G = 9.81


def p(expr):
    """Выполнить выражение в node с загруженным модулем и вернуть результат."""
    src = 'const P = require(%s); console.log(JSON.stringify(%s));' % (
        json.dumps(PHYS_JS), expr)
    r = subprocess.run(['node', '-e', src], capture_output=True, text=True)
    assert r.returncode == 0, 'node упал: %s' % r.stderr.strip()[:400]
    return json.loads(r.stdout.strip())


# ---------------------------------------------------------------- самопроверка

def test_selftest_passes():
    bad = p('P.selftest()')
    assert bad == [], 'самопроверка модуля нашла расхождения:\n' + '\n'.join(bad)


# ------------------------------------------------------------------ механика

def test_projectile_matches_python():
    """Бросок под углом, выписанный заново: T = 2v₀sinα/g, H = v₀²sin²α/2g,
    L = v₀²sin2α/g (Чертов, раздел «Кинематика»)."""
    v0, a = 25.0, 35.0
    rad = math.radians(a)
    got = p('P.projectile(%r, %r)' % (v0, a))
    assert got['T'] == pytest.approx(2 * v0 * math.sin(rad) / G, rel=1e-12)
    assert got['H'] == pytest.approx((v0 * math.sin(rad)) ** 2 / (2 * G), rel=1e-12)
    assert got['L'] == pytest.approx(v0 ** 2 * math.sin(2 * rad) / G, rel=1e-12)


def test_circular_acceleration():
    """a_τ постоянно, a_n = v²/R, полное — гипотенуза."""
    R, at, t = 0.20, 0.050, 5.0
    v = at * t
    got = p('P.circular(%r, %r, %r)' % (R, at, t))
    assert got['v'] == pytest.approx(v, rel=1e-12)
    assert got['an'] == pytest.approx(v * v / R, rel=1e-12)
    assert got['a'] == pytest.approx(math.hypot(at, v * v / R), rel=1e-12)


def test_connected_bodies():
    """Классическая связка через блок: a = (m₁ − μm₂)g/(m₁+m₂),
    натяжение T = m₁(g − a)."""
    m1, m2, mu = 0.50, 2.0, 0.10
    a = (m1 - mu * m2) * G / (m1 + m2)
    got = p('P.connected(%r, %r, %r)' % (m1, m2, mu))
    assert got['a'] == pytest.approx(a, rel=1e-12)
    assert got['T'] == pytest.approx(m1 * (G - a), rel=1e-12)


def test_inelastic_collision_conserves_momentum():
    """Импульс сохраняется точно, энергия — нет: это и проверяем."""
    got = p('P.inelastic(0.5, 4.0, 1.5, -1.0)')
    assert (0.5 + 1.5) * got['u'] == pytest.approx(0.5 * 4.0 + 1.5 * (-1.0), rel=1e-12)
    assert got['dE'] > 0


def test_rolling_bodies_order():
    """Скатывание: скорость v = √(2gh/(1+κ)); порядок тел не зависит ни от
    массы, ни от радиуса — только от κ (Иродов, «Динамика твёрдого тела»)."""
    h, alpha = 1.0, 30.0
    for kappa in (0.4, 0.5, 1.0):
        got = p('P.rolling(%r, %r, %r, true)' % (kappa, h, alpha))
        assert got['v'] == pytest.approx(math.sqrt(2 * G * h / (1 + kappa)), rel=1e-12)
    ball = p('P.rolling(0.4, 1.0, 30, true)')['v']
    disk = p('P.rolling(0.5, 1.0, 30, true)')['v']
    hoop = p('P.rolling(1.0, 1.0, 30, true)')['v']
    assert ball > disk > hoop


def test_zhukovsky_conserves_angular_momentum():
    I1, n1, I2 = 2.5, 1.2, 0.8
    got = p('P.zhukovsky(%r, %r, %r)' % (I1, n1, I2))
    assert I2 * got['w2'] == pytest.approx(I1 * got['w1'], rel=1e-12)
    assert got['A'] == pytest.approx(got['E2'] - got['E1'], rel=1e-12)


def test_steiner():
    """Теорема Штейнера — базовая проверка: диск на расстоянии d от оси."""
    got = p('P.inertia.steiner(P.inertia.disk(2, 0.3), 2, 0.5)')
    assert got == pytest.approx(2 * 0.3 ** 2 / 2 + 2 * 0.5 ** 2, rel=1e-12)


# --------------------------------------------------------- колебания и волны

def test_roll_period_matches_dwyer_formula():
    """Период бортовой качки T = 2π·i_x/√(g·h), i_x = c·B (формула Дуайра).
    Проверяем и обратную зависимость от метацентрической высоты."""
    B, h, c = 18.0, 0.85, 0.38
    want = 2 * math.pi * c * B / math.sqrt(G * h)
    got = p('P.rollPeriod(%r, %r)' % (B, h))
    assert got['T'] == pytest.approx(want, rel=1e-12)
    # вчетверо большая метацентрическая высота вдвое укорачивает период
    quad = p('P.rollPeriod(%r, %r)' % (B, 4 * h))
    assert quad['T'] == pytest.approx(got['T'] / 2, rel=1e-12)


def test_damped_oscillations():
    """λ = βT, Q = π/λ, время релаксации τ = 1/β."""
    w0, beta = 12.0, 0.35
    w = math.sqrt(w0 ** 2 - beta ** 2)
    T = 2 * math.pi / w
    got = p('P.damped(%r, %r)' % (w0, beta))
    assert got['T'] == pytest.approx(T, rel=1e-12)
    assert got['lambda'] == pytest.approx(beta * T, rel=1e-12)
    assert got['Q'] == pytest.approx(math.pi / (beta * T), rel=1e-12)
    assert got['tau'] == pytest.approx(1 / beta, rel=1e-12)


def test_doppler_direction():
    """Сближение повышает частоту, удаление понижает — знаки не перепутаны."""
    nu0, c = 30000.0, 1500.0
    assert p('P.doppler(%r, %r, 5, 0)' % (nu0, c)) > nu0
    assert p('P.doppler(%r, %r, -5, 0)' % (nu0, c)) < nu0
    assert p('P.doppler(%r, %r, 0, 5)' % (nu0, c)) == pytest.approx(
        nu0 * c / (c - 5), rel=1e-12)


# ------------------------------------- молекулярная физика и термодинамика

def test_ideal_gas_matches_python():
    """pV = (m/M)RT, ρ = pM/(RT) — Трофимова, «Молекулярная физика»."""
    pr, V, T, M = 1.5e6, 0.040, 290.0, 0.032
    R = 8.314
    got = p('P.idealGas(%r, %r, %r, %r)' % (pr, V, T, M))
    assert got['nu'] == pytest.approx(pr * V / (R * T), rel=1e-9)
    assert got['m'] == pytest.approx(pr * V / (R * T) * M, rel=1e-9)
    assert got['rho'] == pytest.approx(pr * M / (R * T), rel=1e-9)


def test_maxwell_speed_ratios():
    """Точные отношения √2 : √(8/π) : √3 не зависят ни от газа, ни от T."""
    got = p('P.mkt(320, 0.028)')
    assert got['vMean'] / got['vProb'] == pytest.approx(
        math.sqrt(8 / math.pi) / math.sqrt(2), rel=1e-12)
    assert got['vRms'] / got['vProb'] == pytest.approx(math.sqrt(1.5), rel=1e-12)


def test_adiabat_matches_poisson():
    """Уравнение Пуассона: T₂ = T₁·(V₁/V₂)^(γ−1), p₂ = p₁·(V₁/V₂)^γ."""
    nu, i, T1, p1, ratio = 1.0, 5, 300.0, 1e5, 12.0
    gamma = (i + 2) / i
    got = p('P.proc.adiabat(%r, %d, %r, %r, %r)' % (nu, i, T1, p1, ratio))
    assert got['T2'] == pytest.approx(T1 * ratio ** (gamma - 1), rel=1e-12)
    assert got['p2'] == pytest.approx(p1 * ratio ** gamma, rel=1e-12)
    # в адиабатном процессе работа совершается только за счёт внутренней энергии
    assert got['A'] == pytest.approx(-got['dU'], rel=1e-12)


def test_carnot_efficiency():
    got = p('P.carnot(650, 300, 5000)')
    assert got['eta'] == pytest.approx(1 - 300 / 650, rel=1e-12)
    assert got['Q1'] == pytest.approx(got['A'] + got['Q2'], rel=1e-9)


def test_wall_heat_transfer_matches_python():
    """Многослойная стенка: R = 1/α₁ + Σδ/λ + 1/α₂, q = (t₁−t₂)/R.
    Числа — борт судна: 12 мм стали и 50 мм минеральной ваты."""
    layers = [(0.012, 45.0), (0.050, 0.041), (0.004, 0.15)]
    a_in, a_out, t_in, t_out = 8.0, 23.0, 20.0, -20.0
    R = 1 / a_in + 1 / a_out + sum(d / lam for d, lam in layers)
    q = (t_in - t_out) / R
    got = p('P.wall(%s, %r, %r, %r, %r)' % (
        json.dumps([{'delta': d, 'lambda': lam} for d, lam in layers]),
        a_in, a_out, t_in, t_out))
    assert got['R'] == pytest.approx(R, rel=1e-12)
    assert got['K'] == pytest.approx(1 / R, rel=1e-12)
    assert got['q'] == pytest.approx(q, rel=1e-12)
    # сталь практически не сопротивляется: её перепад меньше сотой доли градуса
    steel_drop = q * layers[0][0] / layers[0][1]
    assert steel_drop < 0.01
    # а вата держит основную часть перепада
    wool_drop = q * layers[1][0] / layers[1][1]
    assert wool_drop > 0.8 * (t_in - t_out)


# --------------------------------------------- свойства тел и жидкостей

def test_hooke_and_stored_energy():
    """σ = F/A, ΔL = σL/E, W = FΔL/2 — энергия рвущегося троса."""
    F, A, L, E = 2.0e5, 4.0e-4, 60.0, 2.0e11
    sigma = F / A
    dL = sigma * L / E
    got = p('P.hooke(%r, %r, %r, %r)' % (F, A, L, E))
    assert got['sigma'] == pytest.approx(sigma, rel=1e-12)
    assert got['dL'] == pytest.approx(dL, rel=1e-12)
    assert got['W'] == pytest.approx(F * dL / 2, rel=1e-12)


def test_thermal_stress_independent_of_length():
    """Термическое напряжение при жёстком закреплении не зависит от длины —
    это ровно то, ради чего задача и решается."""
    a, dT, E = 1.2e-5, 40.0, 2.0e11
    short = p('P.expansion(2, %r, %r, %r)' % (a, dT, E))
    long_ = p('P.expansion(200, %r, %r, %r)' % (a, dT, E))
    assert short['sigmaBlocked'] == pytest.approx(long_['sigmaBlocked'], rel=1e-12)
    assert short['sigmaBlocked'] == pytest.approx(E * a * dT, rel=1e-12)
    assert long_['dL'] == pytest.approx(100 * short['dL'], rel=1e-12)


def test_buoyancy_and_draft_change():
    """Водоизмещение D = ρ·V; приём груза увеличивает осадку на δT = m/(ρ·Aw)."""
    L, B, T, delta = 120.0, 18.0, 6.5, 0.72
    rho = 1025.0
    V = L * B * T * delta
    got = p('P.buoyancy(%r, %r, %r, %r, %r)' % (L, B, T, rho, delta))
    assert got['V'] == pytest.approx(V, rel=1e-12)
    assert got['D'] == pytest.approx(rho * V, rel=1e-12)
    dr = p('P.draftChange(100000, %r, %r, %r, 0.85)' % (L, B, rho))
    assert dr['dT'] == pytest.approx(100000 / (rho * L * B * 0.85), rel=1e-12)
    # число тонн на сантиметр осадки
    assert dr['TPC'] == pytest.approx(rho * L * B * 0.85 * 0.01, rel=1e-12)


def test_saturated_vapour_pressure_reference_points():
    """Опорные точки таблицы насыщенного пара воды: при 100 °C давление равно
    атмосферному, при 20 °C — 2,34 кПа. Аппроксимация Антуана — источник
    вторичный, поэтому допуск 2 %."""
    assert p('P.pSat(100)') == pytest.approx(101325, rel=0.01)
    assert p('P.pSat(20)') == pytest.approx(2339, rel=0.02)
    assert p('P.pSat(50)') == pytest.approx(12344, rel=0.02)


def test_cavitation_number_decreases_with_speed():
    """Число кавитации σ = (p − p_н)/(ρv²/2): растёт с глубиной, падает со
    скоростью. Кавитация начинается, когда σ падает ниже критического."""
    slow = p('P.cavitation(5, 15, 15)')
    fast = p('P.cavitation(5, 30, 15)')
    deep = p('P.cavitation(20, 30, 15)')
    assert fast['sigma'] == pytest.approx(slow['sigma'] / 4, rel=1e-9)
    assert deep['sigma'] > fast['sigma']


# ------------------------------------------------ электричество и магнетизм

def test_source_power_and_efficiency():
    """Максимум полезной мощности при R = r, КПД при этом ровно 50 % —
    классический результат, который студенты чаще всего путают."""
    emf, r = 24.0, 0.8
    matched = p('P.source(%r, %r, %r)' % (emf, r, r))
    assert matched['Puse'] == pytest.approx(emf ** 2 / (4 * r), rel=1e-12)
    assert matched['eta'] == pytest.approx(0.5, rel=1e-12)
    # при большем сопротивлении КПД выше, а мощность — ниже
    high = p('P.source(%r, %r, %r)' % (emf, r, 10 * r))
    assert high['eta'] > matched['eta']
    assert high['Puse'] < matched['Puse']


def test_kirchhoff_satisfies_both_laws():
    """Проверяем не «ответ», а сами законы: узел и два контура."""
    e1, r1, e2, r2, R3 = 12.0, 0.5, 9.0, 0.8, 4.0
    got = p('P.kirchhoff2(%r, %r, %r, %r, %r)' % (e1, r1, e2, r2, R3))
    assert got['I3'] == pytest.approx(got['I1'] + got['I2'], rel=1e-12)
    assert e1 == pytest.approx(got['I1'] * r1 + got['I3'] * R3, rel=1e-9)
    assert e2 == pytest.approx(got['I2'] * r2 + got['I3'] * R3, rel=1e-9)


def test_cable_voltage_drop():
    """Двухпроводная линия: ток идёт туда и обратно, поэтому 2L."""
    I, L, S, rho, U0 = 120.0, 85.0, 50e-6, 1.75e-8, 220.0
    R = rho * 2 * L / S
    got = p('P.cable(%r, %r, %r, %r, %r)' % (I, L, S, rho, U0))
    assert got['R'] == pytest.approx(R, rel=1e-12)
    assert got['dU'] == pytest.approx(I * R, rel=1e-12)
    assert got['P'] == pytest.approx(I * I * R, rel=1e-12)


def test_lorentz_radius_and_period():
    """r = mv/(qB) растёт со скоростью, T = 2πm/(qB) — нет. На этом стоит
    циклотрон, и это же ловит половину ошибок в задаче."""
    slow = p('P.lorentz(P.C.me, P.C.e, 1e6, 0.02)')
    fast = p('P.lorentz(P.C.me, P.C.e, 3e6, 0.02)')
    assert fast['r'] == pytest.approx(3 * slow['r'], rel=1e-12)
    assert fast['T'] == pytest.approx(slow['T'], rel=1e-12)


def test_compass_deviation_shape():
    """Полукруговая девиация: ноль на курсах 0° и 180°, максимум на 90°,
    знак меняется на 270°."""
    Hs, He = 2.2e-6, 1.6e-5
    for course in (0, 180, 360):
        assert abs(p('P.deviation(%r, %r, %d).deltaDeg' % (Hs, He, course))) < 1e-9
    d90 = p('P.deviation(%r, %r, 90).deltaDeg' % (Hs, He))
    d270 = p('P.deviation(%r, %r, 270).deltaDeg' % (Hs, He))
    assert d90 == pytest.approx(math.degrees(math.atan(Hs / He)), rel=1e-12)
    assert d270 == pytest.approx(-d90, rel=1e-12)


# ---------------------------------------------------------------- оптика

def test_grating_orders():
    """d·sinφ = mλ; порядков не больше d/λ."""
    d, lam = 1 / 500e3, 589e-9      # решётка 500 штрихов на мм
    got = p('P.grating(%r, %r, 2)' % (d, lam))
    assert got['sin'] == pytest.approx(2 * lam / d, rel=1e-12)
    assert got['mMax'] == int(d / lam)
    # порядок, для которого sinφ > 1, должен быть помечен как невозможный
    assert p('P.grating(%r, %r, %d).ok' % (d, lam, int(d / lam) + 1)) is False


def test_brewster_and_refraction_are_consistent():
    """При угле Брюстера отражённый и преломлённый лучи перпендикулярны."""
    n = 1.52
    br = p('P.brewster(%r)' % n)
    refr = p('P.refraction(1, %r, %r).angle2Deg' % (n, br))
    assert br + refr == pytest.approx(90.0, abs=1e-6)


def test_total_internal_reflection():
    """Предельный угол вода → воздух — 48,6°, за ним преломления нет."""
    crit = p('P.refraction(1.333, 1, 0).critDeg')
    assert crit == pytest.approx(48.6, abs=0.1)
    assert p('P.refraction(1.333, 1, %r).angle2Deg' % (crit + 5)) is None


def test_light_range_solves_allard_equation():
    """Дальность огня — корень уравнения Аллара I·e^(−qd)/d² = E.
    Проверяем подстановкой корня обратно в уравнение, а не сверкой с числом."""
    I, Vmet = 1000.0, 10.0
    got = p('P.lightRange(%r, 5, 12, %r)' % (I, Vmet))
    q = 3 / (Vmet * 1852)
    d = got['optM']
    assert I * math.exp(-q * d) / d ** 2 == pytest.approx(2e-7, rel=1e-3)
    # геометрическая дальность — формула 2,08(√h_гл + √h_огня), мили
    assert got['geoNm'] == pytest.approx(
        2.08 * (math.sqrt(5) + math.sqrt(12)), rel=1e-12)


def test_light_range_quadrupling_intensity_is_not_quadrupling_distance():
    """Ключевой вывод задачи: вчетверо более сильный огонь виден далеко не
    вчетверо дальше — экспонента съедает выигрыш."""
    weak = p('P.lightRange(1000, 5, 12, 10).optNm')
    strong = p('P.lightRange(4000, 5, 12, 10).optNm')
    assert strong < 2 * weak


# --------------------------------------------- квантовая и ядерная физика

def test_photoeffect_einstein_equation():
    """hc/λ = A + E_к; на красной границе кинетическая энергия равна нулю."""
    lam_nm, A_ev = 400.0, 2.0
    h, c, e = 6.626e-34, 2.998e8, 1.602e-19
    Eph = h * c / (lam_nm * 1e-9)
    got = p('P.photoeffect(%r, %r)' % (lam_nm, A_ev))
    assert got['Eph'] == pytest.approx(Eph, rel=1e-9)
    assert got['EkEv'] == pytest.approx(Eph / e - A_ev, rel=1e-6)
    assert got['lam0nm'] == pytest.approx(h * c / (A_ev * e) * 1e9, rel=1e-9)


def test_binding_energy_helium_and_iron():
    """Опорные точки кривой энергии связи: гелий-4 — 7,07 МэВ/нуклон,
    железо-56 — около 8,79 МэВ/нуклон (максимум кривой)."""
    he = p('P.bindingEnergy(2, 2, 4.00260)')
    assert he['perNucleon'] == pytest.approx(7.07, abs=0.02)
    fe = p('P.bindingEnergy(26, 30, 55.93494)')
    assert fe['perNucleon'] == pytest.approx(8.79, abs=0.05)
    assert fe['perNucleon'] > he['perNucleon']


def test_decay_law():
    """N = N₀·2^(−t/T½); λT½ = ln2."""
    half, N0 = 1600.0, 1e20
    got = p('P.decay(%r, %r, %r)' % (half, N0, 3 * half))
    assert got['frac'] == pytest.approx(0.125, rel=1e-12)
    assert got['lambda'] * half == pytest.approx(math.log(2), rel=1e-12)
    assert got['A0'] == pytest.approx(math.log(2) / half * N0, rel=1e-12)


def test_shielding_inverse_square_and_exponential():
    """Защита работает двумя способами сразу: геометрией (1/r²) и
    поглощением (e^(−μd)). Проверяем каждый отдельно."""
    near = p('P.doseRate(1, 1e12, 1, 0, 0)')['rate']
    far = p('P.doseRate(1, 1e12, 3, 0, 0)')['rate']
    assert far == pytest.approx(near / 9, rel=1e-12)
    mu = 0.12
    shielded = p('P.doseRate(1, 1e12, 1, %r, 10)' % mu)['rate']
    assert shielded == pytest.approx(near * math.exp(-mu * 10), rel=1e-12)
    assert p('P.shieldThickness(%r, 100)' % mu) == pytest.approx(
        math.log(100) / mu, rel=1e-12)


# ------------------------------------------------------ структурные проверки

def test_module_is_pure():
    """Ядро обязано грузиться в node: обращение к DOM сломает и тесты, и
    переиспользование модуля виртуальными работами."""
    with open(PHYS_JS, encoding='utf-8') as fh:
        src = fh.read()
    for bad in ('document.', 'querySelector', 'window.addEventListener'):
        assert bad not in src, 'модуль обращается к DOM: %s' % bad


def test_constants_match_reference_page():
    """Постоянные в модуле и в справочнике сайта не должны разъезжаться:
    иначе задача и справочник дадут разные ответы."""
    page = os.path.join(SITE, 'constants.html')
    if not os.path.isfile(page):
        pytest.skip('нет constants.html')
    with open(page, encoding='utf-8') as fh:
        text = fh.read()
    # ускорение свободного падения и заряд электрона обязаны встречаться
    consts = p('P.C')
    assert consts['g'] == 9.81
    assert re.search(r'9[,.]81', text), 'в справочнике нет значения g'
    assert consts['e'] == pytest.approx(1.602e-19, rel=1e-3)
    assert consts['NA'] == pytest.approx(6.022e23, rel=1e-3)
    assert consts['R'] == pytest.approx(8.314, rel=1e-3)


# ==========================================================================
#  ФУНКЦИИ, ДОБАВЛЕННЫЕ ПРИ РАЗБОРЕ ЗАДАЧ
#  (пересчёт на Python по формулам, выписанным заново)
# ==========================================================================

def test_drift_matches_navigation_triangle():
    """Навигационный треугольник скоростей: sin β = u⊥/v, путевая скорость
    V = v·cos β + u∥. Проверяем на произвольном, «некруглом» случае."""
    v, u, track, direction = 12.0, 3.0, 90.0, 30.0
    th = math.radians(direction - track)
    beta = math.asin(u * math.sin(th) / v)
    V = v * math.cos(beta) + u * math.cos(th)
    got = p('P.drift(%r, %r, %r, %r)' % (v, u, track, direction))
    assert got['beta'] == pytest.approx(math.degrees(beta), rel=1e-12)
    assert got['V'] == pytest.approx(V, rel=1e-12)
    # истинный курс отличается от линии пути ровно на угол сноса
    assert got['heading'] == pytest.approx(track - math.degrees(beta), rel=1e-12)


def test_elastic_collision_conserves_both():
    """Упругий удар обязан сохранять и импульс, и энергию — иначе формула
    выписана неверно. Проверяем на несимметричных массах и встречных скоростях."""
    m1, v1, m2, v2 = 0.35, 4.0, 1.10, -1.5
    got = p('P.elastic(%r, %r, %r, %r)' % (m1, v1, m2, v2))
    assert m1 * got['u1'] + m2 * got['u2'] == pytest.approx(m1 * v1 + m2 * v2, rel=1e-12)
    assert (m1 * got['u1'] ** 2 + m2 * got['u2'] ** 2) / 2 == pytest.approx(
        (m1 * v1 ** 2 + m2 * v2 ** 2) / 2, rel=1e-12)


def test_deep_water_wave_dispersion():
    """Гравитационная волна на глубокой воде: λ = gτ²/2π, c = λ/τ.
    Волна с периодом 8 с имеет длину 100 м и бежит со скоростью 12,5 м/с."""
    tau = 8.0
    got = p('P.waveDeep(%r)' % tau)
    assert got['lambda'] == pytest.approx(G * tau ** 2 / (2 * math.pi), rel=1e-12)
    assert got['lambda'] == pytest.approx(99.9, abs=0.5)
    assert got['c'] == pytest.approx(got['lambda'] / tau, rel=1e-12)


def test_encounter_period_and_roll_resonance():
    """Кажущийся период τэ = τ/(1 − (v/c)·cos μ) и обратная к нему задача о
    курсе резонанса должны быть строго согласованы."""
    tau, v = 7.0, 6.5
    for mu in (30.0, 75.0, 140.0):
        c = p('P.waveDeep(%r).c' % tau)
        want = abs(tau / (1 - v / c * math.cos(math.radians(mu))))
        assert p('P.encounterPeriod(%r, %r, %r).tauE' % (tau, v, mu)) == pytest.approx(
            want, rel=1e-12)
    # курс, дающий резонанс с собственным периодом качки
    troll = 10.0
    mu = p('P.rollResonanceCourse(%r, %r, %r).muDeg' % (tau, troll, v))
    assert mu is not None
    assert p('P.encounterPeriod(%r, %r, %r).tauE' % (tau, v, mu)) == pytest.approx(
        troll, rel=1e-6)


def test_barometric_formula():
    """p(h) = p₀·exp(−Mgh/RT). На 5,5 км давление падает примерно вдвое."""
    p0, T, M, h = 101325.0, 273.0, 0.029, 5500.0
    want = p0 * math.exp(-M * G * h / (8.314 * T))
    got = p('P.barometric(%r, %r, %r, %r)' % (p0, T, M, h))
    assert got['p'] == pytest.approx(want, rel=1e-9)
    assert got['p'] / p0 == pytest.approx(0.5, abs=0.03)


def test_diving_bell_obeys_boyle():
    """Колокол: давление запертого воздуха отсчитывается от уровня воды
    ВНУТРИ него, а не от кромки. Проверяем корень квадратного уравнения
    подстановкой в закон Бойля."""
    L, S, depth, T = 2.5, 4.0, 25.0, 283.0
    got = p('P.divingBell(%r, %r, %r, %r, {})' % (L, S, depth, T))
    rho, patm = 1025.0, 101325.0
    # давление на уровне воды внутри колокола
    assert got['p'] == pytest.approx(patm + rho * G * (depth + got['l']), rel=1e-9)
    assert got['p'] * got['l'] == pytest.approx(patm * L, rel=1e-9)
    assert 0 < got['l'] < L


def test_dew_point_is_inverse_of_psat():
    """Точка росы обращает давление насыщенного пара: при относительной
    влажности φ парциальное давление φ·pSat(t) должно стать насыщающим
    ровно при t = точка росы."""
    for t, phi in ((20.0, 0.60), (25.0, 0.80), (5.0, 0.95)):
        td = p('P.dewPoint(%r, %r)' % (t, phi))
        assert td < t
        assert p('P.pSat(%r)' % td) == pytest.approx(phi * p('P.pSat(%r)' % t), rel=1e-6)


def test_heat_exchange_entropy_grows():
    """Второе начало: при теплообмене двух тел энтропия системы растёт.
    Проверяем прямым пересчётом ΔS = C₁ln(T/T₁) + C₂ln(T/T₂)."""
    m1, c1, T1, m2, c2, T2 = 1.5, 4190.0, 350.0, 3.0, 900.0, 290.0
    C1, C2 = m1 * c1, m2 * c2
    Tmix = (C1 * T1 + C2 * T2) / (C1 + C2)
    dS = C1 * math.log(Tmix / T1) + C2 * math.log(Tmix / T2)
    got = p('P.heatExchange(%r, %r, %r, %r, %r, %r)' % (m1, c1, T1, m2, c2, T2))
    assert got['Tmix'] == pytest.approx(Tmix, rel=1e-12)
    assert got['dS'] == pytest.approx(dS, rel=1e-9)
    assert got['dS'] > 0


def test_capacitor_battery():
    """Последовательное соединение 2, 3 и 6 мкФ даёт ровно 1 мкФ; напряжения
    делятся обратно пропорционально ёмкостям."""
    caps = [2e-6, 3e-6, 6e-6]
    got = p('P.capBattery(%s, 100)' % json.dumps(caps))
    assert got['Cser'] == pytest.approx(1 / sum(1 / c for c in caps), rel=1e-12)
    assert got['Cpar'] == pytest.approx(sum(caps), rel=1e-12)
    assert sum(got['Uk']) == pytest.approx(100.0, rel=1e-9)
    # на самом маленьком конденсаторе — самое большое напряжение
    assert got['Uk'][0] == max(got['Uk'])


def test_winding_temperature_method():
    """Метод сопротивления: t₂ = R₂/R₁·(k + t₁) − k. Обмотка сама себе
    термометр, и формула обязана быть точным обращением."""
    R1, t1, R2, k = 0.500, 20.0, 0.620, 235.0
    want = R2 / R1 * (k + t1) - k
    got = p('P.windingTemp(%r, %r, %r)' % (R1, t1, R2))
    assert got['t2'] == pytest.approx(want, rel=1e-12)
    assert got['rise'] == pytest.approx(want - t1, rel=1e-12)


def test_bohr_levels_and_balmer_line():
    """Уровни водорода E_n = −13,6/n² эВ; головная линия Бальмера 656 нм,
    граница серии Бальмера — 365 нм."""
    assert p('P.bohr(1).EeV') == pytest.approx(-13.6, abs=0.01)
    assert p('P.bohr(3).EeV') == pytest.approx(-13.6 / 9, abs=0.01)
    assert p('P.hydrogenLine(2, 3).lamNm') == pytest.approx(656.3, abs=1.0)
    assert p('P.hydrogenLine(2, 4).lamNm') == pytest.approx(486.1, abs=1.0)


def test_compton_shift_formula():
    """Δλ = λ_C(1 − cos θ), λ_C = h/(m_e c) = 2,426 пм."""
    h, me, c = 6.626e-34, 9.109e-31, 2.998e8
    lam_c = h / (me * c) * 1e12
    for theta in (30.0, 90.0, 150.0):
        want = lam_c * (1 - math.cos(math.radians(theta)))
        assert p('P.compton(50, %r).dLamPm' % theta) == pytest.approx(want, rel=1e-6)


def test_fission_energy_per_kilogram():
    """Килограмм урана-235 при 200 МэВ на деление даёт около 8,2·10¹³ Дж —
    примерно в два миллиона раз больше килограмма мазута."""
    QMeV, Mmol, e, NA = 200.0, 235.0, 1.602e-19, 6.022e23
    want = QMeV * 1e6 * e * NA * 1000 / Mmol
    got = p('P.fission(%r, %r, 1e6, 1, 40e6)' % (QMeV, Mmol))
    assert got['ePerKg'] == pytest.approx(want, rel=1e-9)
    assert got['ratio'] == pytest.approx(want / 40e6, rel=1e-9)
    assert got['ratio'] > 1e6


def test_beam_deflection_cubic_in_thickness():
    """Стрела прогиба f = FL³/(48EI), I = bh³/12: толщина входит в кубе,
    поэтому вдвое более толстая балка прогибается в восемь раз меньше."""
    thin = p('P.beamCenterLoad(9.81, 0.60, 0.020, 0.003, 2.0e11)')
    thick = p('P.beamCenterLoad(9.81, 0.60, 0.020, 0.006, 2.0e11)')
    assert thin['f'] / thick['f'] == pytest.approx(8.0, rel=1e-9)
    want = 9.81 * 0.60 ** 3 / (48 * 2.0e11 * 0.020 * 0.003 ** 3 / 12)
    assert thin['f'] == pytest.approx(want, rel=1e-12)


def test_thin_lens_formula():
    """1/f = 1/d + 1/d′; предмет в двойном фокусе даёт равное изображение."""
    f, d = 0.12, 0.18
    assert p('P.thinLens(%r, %r).dImg' % (f, d)) == pytest.approx(
        1 / (1 / f - 1 / d), rel=1e-12)
    assert p('P.thinLens(%r, %r).magn' % (f, 2 * f)) == pytest.approx(1.0, rel=1e-12)


def test_rl_break_emf_scales_with_speed_of_break():
    """ЭДС самоиндукции при размыкании обратно пропорциональна времени
    разрыва — потому быстрый разрыв индуктивной цепи и даёт искру."""
    slow = p('P.rlBreak(0.05, 10, 3, 1e-3).emf')
    fast = p('P.rlBreak(0.05, 10, 3, 1e-5).emf')
    assert fast == pytest.approx(100 * slow, rel=1e-12)
    assert p('P.rlBreak(0.05, 10, 3, 1e-3).W') == pytest.approx(0.05 * 9 / 2, rel=1e-12)


# ==========================================================================
#  СТРАНИЦА И МОДУЛЬ НЕ ДОЛЖНЫ РАЗЪЕЗЖАТЬСЯ
# ==========================================================================
#
# Разборы печатают числа в разметке, а считает их phys.js. Если модуль
# поправят, а страницу забудут (или наоборот), ни один из тестов выше этого
# не заметит: и модуль верен, и HTML валиден, а сайт врёт. Здесь для каждой
# страницы взято по ключевому числу её главной задачи; значение вычисляется
# модулем прямо в тесте и ищется в тексте страницы.

def _ru(x, dec):
    """Число в том виде, в каком оно печатается на странице: запятая-разделитель."""
    return ('%.*f' % (dec, x)).replace('.', ',')


PAGE_VALUES = [
    # страница,        выражение для модуля,                          знаков
    ('p-kinematics', 'P.drift(12, 3, 90, 30).heading', 1),
    ('p-kinematics', 'P.shipAccel(1.5e6, 1.5e5, 4.2e3, 0.9).vInf', 2),
    ('p-conserv', 'P.waterJet(1.2, 12, 20).thrust / 1000', 2),
    ('p-molecular', 'P.barometric(101325, 273, 0.029, 3000).H / 1000', 2),
    ('p-thermo', 'P.wall([{delta:0.008,lambda:0.15},{delta:0.05,lambda:0.041},'
                 '{delta:0.012,lambda:45}], 8, 23, 20, -20).K', 3),
    ('p-solid', 'P.cavitation(4, 1, 15).vCrit', 1),
    ('p-magnetism', 'P.deviation(2e-6, 1.6e-5, 90).deltaDeg', 2),
    ('p-optics', 'P.refraction(1.333, 1, 0).critDeg', 1),
    ('p-quantum', 'P.bohr(1).rNm', 4),
]


@pytest.mark.parametrize('page,expr,dec', PAGE_VALUES,
                         ids=[v[0] + ':' + v[1][:28] for v in PAGE_VALUES])
def test_page_value_matches_module(page, expr, dec):
    path = os.path.join(SITE, page + '.html')
    if not os.path.isfile(path):
        pytest.skip('нет страницы ' + page)
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    want = _ru(p(expr), dec)
    assert want in text, (
        'страница %s разошлась с модулем: %s даёт %s, а на странице такого '
        'числа нет' % (page, expr, want))
