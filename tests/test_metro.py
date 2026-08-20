# -*- coding: utf-8 -*-
"""Проверка модуля обработки измерений site/assets/metro.js.

metro.js — единственное место, где живёт статистика практикума: среднее,
СКО, коэффициенты Стьюдента, суммирование погрешностей, перенос погрешности
на косвенные измерения, метод наименьших квадратов и округление результата.
Ошибка здесь не поймается ни разбором HTML, ни проверкой ссылок: страница
останется валидной, а доверительный интервал станет неверным — и студент
запишет в отчёт неправду.

Проверка идёт двумя независимыми путями:
  * встроенная самопроверка METRO.selftest() — контрольные точки, которые
    считаются в уме (ряд 1…5, точная прямая, постоянный ряд);
  * пересчёт на Python по формулам, выписанным здесь ЗАНОВО из руководства
    по обработке наблюдений, — так опечатка в JS не может подтвердить сама
    себя. Там, где есть замкнутая формула (МНК, перенос погрешности
    степенного одночлена), она выписана независимо от кода модуля.
"""
import json
import math
import os
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METRO_JS = os.path.join(ROOT, 'site', 'assets', 'metro.js')

pytestmark = [
    pytest.mark.skipif(not os.path.isfile(METRO_JS), reason='нет site/assets/metro.js'),
    pytest.mark.skipif(not shutil.which('node'), reason='node не установлен'),
]


def m(expr):
    """Выполнить выражение в node с загруженным модулем и вернуть результат."""
    src = 'const M = require(%s); console.log(JSON.stringify(%s));' % (
        json.dumps(METRO_JS), expr)
    r = subprocess.run(['node', '-e', src], capture_output=True, text=True)
    assert r.returncode == 0, 'node упал: %s' % r.stderr.strip()[:400]
    return json.loads(r.stdout.strip())


# ---------------------------------------------------------------- самопроверка

def test_selftest_passes():
    bad = m('M.selftest()')
    assert bad == [], 'самопроверка модуля нашла расхождения:\n' + '\n'.join(bad)


# ------------------------------------------- независимый пересчёт на Python

#: ряд отсчётов периода маятника, с, из протокола работы 1-18
SERIES = [1.412, 1.418, 1.409, 1.421, 1.415, 1.410, 1.419]

#: коэффициенты Стьюдента (таблица кафедры физики), α = 0,95
T95 = {2: 12.7, 3: 4.3, 4: 3.2, 5: 2.8, 6: 2.6, 7: 2.4, 8: 2.3, 9: 2.2, 10: 2.2}


def py_series(xs, instr=0.0, alpha=0.95):
    """Обработка ряда, выписанная заново: среднее, СКО среднего, интервал."""
    n = len(xs)
    mean = sum(xs) / n
    s2 = sum((x - mean) ** 2 for x in xs)
    sd_mean = math.sqrt(s2 / (n * (n - 1)))
    t = T95[n]
    d_rand = t * sd_mean
    return {
        'mean': mean,
        'Sm': sd_mean,
        'dRand': d_rand,
        'd': math.hypot(d_rand, instr),
    }


def test_series_matches_python():
    got = m('M.series(%s, 0.001)' % json.dumps(SERIES))
    want = py_series(SERIES, 0.001)
    assert got['mean'] == pytest.approx(want['mean'], rel=1e-12)
    assert got['Sm'] == pytest.approx(want['Sm'], rel=1e-12)
    assert got['dRand'] == pytest.approx(want['dRand'], rel=1e-12)
    assert got['d'] == pytest.approx(want['d'], rel=1e-12)


def test_sd_of_measurement_is_sqrt_n_times_sd_of_mean():
    """СКО измерения и СКО среднего связаны множителем √n — это определение,
    и его нарушение означало бы, что интервал занижен или завышен в 2–3 раза."""
    got = m('M.series(%s)' % json.dumps(SERIES))
    assert got['S'] == pytest.approx(got['Sm'] * math.sqrt(len(SERIES)), rel=1e-12)


def test_instrumental_error_dominates_when_scatter_is_small():
    """Если разброса нет, полная погрешность равна приборной — не нулю."""
    got = m('M.series([2.5, 2.5, 2.5, 2.5, 2.5], 0.02)')
    assert got['dRand'] == pytest.approx(0.0, abs=1e-15)
    assert got['d'] == pytest.approx(0.02, rel=1e-12)


def test_student_table_values():
    """Табличные значения не должны «уехать» при правках кода."""
    for n, t in T95.items():
        assert m('M.tStudent(%d, 0.95)' % n) == pytest.approx(t, rel=1e-12)


def test_student_decreases_and_has_limit():
    prev = 1e9
    for n in range(2, 11):
        cur = m('M.tStudent(%d, 0.95)' % n)
        assert cur <= prev, 'коэффициент Стьюдента должен убывать с ростом n'
        prev = cur
    assert m('M.tStudent(1000, 0.95)') == pytest.approx(2.0, rel=1e-12)


# ------------------------------------------------------- косвенные измерения

def test_power_law_matches_hand_formula():
    """Объём цилиндра V = πd²h/4: относительные погрешности складываются
    квадратично с весами-показателями. Считаем формулу руками."""
    d, h, dd, dh = 0.0200, 0.0500, 0.00005, 0.0001
    want = math.hypot(2 * dd / d, dh / h)
    got = m('M.powerLaw(1, [{v:%r,d:%r,p:2},{v:%r,d:%r,p:1}])' % (d, dd, h, dh))
    assert got['rel'] == pytest.approx(want, rel=1e-12)


def test_indirect_numeric_equals_analytic():
    """Численное дифференцирование обязано совпасть с аналитикой на функции,
    для которой аналитика известна: период маятника T = 2π√(L/g)."""
    L, g, dL, dg = 0.800, 9.81, 0.001, 0.01
    T = 2 * math.pi * math.sqrt(L / g)
    want = T * math.hypot(0.5 * dL / L, 0.5 * dg / g)
    got = m('M.indirect(a => 2*Math.PI*Math.sqrt(a[0]/a[1]), [%r, %r], [%r, %r])'
            % (L, g, dL, dg))
    assert got['y'] == pytest.approx(T, rel=1e-12)
    assert got['d'] == pytest.approx(want, rel=1e-6)


def test_indirect_reports_contribution_of_each_argument():
    """Вклады аргументов — это то, ради чего считают перенос погрешности:
    видно, что улучшать в опыте. У длины вклад должен быть много больше."""
    got = m('M.indirect(a => 2*Math.PI*Math.sqrt(a[0]/a[1]), [0.8, 9.81], [0.01, 0.0001])')
    contrib = [abs(t) for t in got['terms']]
    assert contrib[0] > 10 * contrib[1]


# ------------------------------------------------- метод наименьших квадратов

#: точки «удлинение — нагрузка» с заметным разбросом
LSQ_PTS = [[0.0, 0.02], [1.0, 2.05], [2.0, 3.94], [3.0, 6.11], [4.0, 7.98]]


def py_lsq(pts):
    """МНК, выписанный заново (Тейлор, гл. 8)."""
    n = len(pts)
    sx = sum(p[0] for p in pts)
    sy = sum(p[1] for p in pts)
    sxx = sum(p[0] ** 2 for p in pts)
    sxy = sum(p[0] * p[1] for p in pts)
    D = n * sxx - sx * sx
    k = (n * sxy - sx * sy) / D
    b = (sxx * sy - sx * sxy) / D
    res = sum((p[1] - k * p[0] - b) ** 2 for p in pts)
    sy_res = math.sqrt(res / (n - 2))
    return {'k': k, 'b': b, 'Sk': sy_res * math.sqrt(n / D),
            'Sb': sy_res * math.sqrt(sxx / D)}


def test_lsq_matches_python():
    got = m('M.lsq(%s)' % json.dumps(LSQ_PTS))
    want = py_lsq(LSQ_PTS)
    for key in ('k', 'b', 'Sk', 'Sb'):
        assert got[key] == pytest.approx(want[key], rel=1e-10), 'разошлось: ' + key


def test_lsq_slope_is_scale_covariant():
    """Умножение всех y на 3 умножает наклон и его погрешность ровно на 3 —
    свойство, которое ломается при любой опечатке в знаменателе."""
    base = m('M.lsq(%s)' % json.dumps(LSQ_PTS))
    scaled_pts = [[x, 3 * y] for x, y in LSQ_PTS]
    scaled = m('M.lsq(%s)' % json.dumps(scaled_pts))
    assert scaled['k'] == pytest.approx(3 * base['k'], rel=1e-12)
    assert scaled['Sk'] == pytest.approx(3 * base['Sk'], rel=1e-12)


def test_lsq_through_origin_differs_from_free_line():
    """Прямая через начало — не то же самое, что обычный МНК: она обязана
    дать другой наклон, если облако точек смещено."""
    free = m('M.lsq(%s)' % json.dumps(LSQ_PTS))
    thru = m('M.lsqThroughOrigin(%s)' % json.dumps(LSQ_PTS))
    assert thru['k'] != pytest.approx(free['k'], rel=1e-6)
    # но на точках, точно лежащих на прямой через ноль, оба дают одно и то же
    exact = [[1, 2], [2, 4], [3, 6], [4, 8]]
    a = m('M.lsq(%s)' % json.dumps(exact))
    b = m('M.lsqThroughOrigin(%s)' % json.dumps(exact))
    assert a['k'] == pytest.approx(2.0, rel=1e-9)
    assert b['k'] == pytest.approx(2.0, rel=1e-9)


def test_lsq_residual_error_grows_with_scatter():
    """Чем хуже точки ложатся на прямую, тем шире интервал наклона."""
    tight = [[0, 0], [1, 2.0], [2, 4.0], [3, 6.0], [4, 8.01]]
    loose = [[0, 0], [1, 2.4], [2, 3.6], [3, 6.5], [4, 7.5]]
    assert m('M.lsq(%s).Sk' % json.dumps(loose)) > m('M.lsq(%s).Sk' % json.dumps(tight))


# ---------------------------------------------------- округление и вердикт

@pytest.mark.parametrize('x,d,want_x,want_d', [
    (9.8123, 0.0456, 9.81, 0.05),      # ведущая 4 → одна значащая цифра
    (9.8123, 0.0123, 9.812, 0.012),    # ведущая 1 → две значащие цифры
    (9.8123, 0.0234, 9.812, 0.023),    # ведущая 2 → две значащие цифры
    (1234.0, 56.0, 1230.0, 60.0),      # округление вверх по разряду
])
def test_round_pair(x, d, want_x, want_d):
    got = m('M.roundPair(%r, %r)' % (x, d))
    assert got['d'] == pytest.approx(want_d, rel=1e-9)
    assert got['x'] == pytest.approx(want_x, rel=1e-9)


def test_agrees_verdict():
    ok = m('M.agrees(9.79, 0.05, 9.81)')
    assert ok['ok'] is True
    edge = m('M.agrees(9.72, 0.05, 9.81)')
    assert edge['ok'] is False and edge['near'] is True
    miss = m('M.agrees(9.20, 0.05, 9.81)')
    assert miss['ok'] is False and miss['near'] is False


# ------------------------------------------- модуль не должен трогать DOM

def test_module_is_pure():
    """metro.js обязан грузиться в node без окружения браузера: если в него
    заползёт обращение к document или window, тесты и переиспользование
    сломаются, а страница errors.html молча потеряет расчёт."""
    with open(METRO_JS, encoding='utf-8') as fh:
        src = fh.read()
    for bad in ('document.', 'window.addEventListener', 'querySelector'):
        assert bad not in src, 'модуль обращается к DOM: %s' % bad
