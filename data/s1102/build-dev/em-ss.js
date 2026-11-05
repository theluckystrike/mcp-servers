function validateDelta(p) {
    return p > 0 && p < 1 && p + conversion_rate < 1;
}

function addCommas(nStr) {
    nStr += '';
    var x = nStr.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
}
function draw() {
    update_link();
    var points_lo = [];
    var points = [];
    var points_hi = [];

    var max_pixels = 150;
    var p = mde_is_relative ? min_effect * conversion_rate : min_effect;
    var max = conversion_rate;

    if (validateDelta(p)) {
        max = conversion_rate + p;
    }

    if (conversion_rate > 0 && conversion_rate < 1) {
        $( "#ci_label1" ).show();
        $( "#lower_ci1" ).width(conversion_rate / max * max_pixels);
        $( "#upper_ci1" ).width(0);
        $( "#lower_ci_value1" ).html(format_number(100 * conversion_rate, 2));
    } else {
        $( "#ci_label1" ).hide();
        $( "#lower_ci1" ).width(0);
    }

    if (conversion_rate > 0 && validateDelta(p)) {
        $( "#ci_label2" ).show();
        if (one_sided) {
            $( "#lower_ci2" ).width(max_pixels);
            $( "#lower_ci_value2" ).html(format_number(0, 2));
            $( "#upper_ci2" ).width(0);
        } else if (p > conversion_rate) {
            $( "#lower_ci2" ).width(0);
            $( "#lower_ci_value2" ).html(format_number(0, 2));
            $( "#upper_ci2" ).width(max_pixels);
        } else {
            $( "#lower_ci2" ).width((conversion_rate - p) / max * max_pixels);
            $( "#lower_ci_value2" ).html(format_number(100 * (conversion_rate - p), 2));
            $( "#upper_ci2" ).width((2 * p) / max * max_pixels);
        }
        $( "#upper_ci_value2" ).html(format_number(100 * (conversion_rate + p), 2));
    } else {
        $( "#lower_ci2" ).width(0);
        $( "#upper_ci2" ).width(0);
        $( "#ci_label2" ).hide();
    }

    var answer = "&mdash;";
    if (conversion_rate > 0 && validateDelta(p)) {
        var n = num_subjects(alpha_level, power_level, conversion_rate, p);
        if (!isNaN(n)) {
            answer = addCommas(""+Math.round(n));
        }
    } else {
        didReceiveInvalidInput();
    }
    $( "#verdict_text" ).html(answer);
    didFinishDrawing();
}
function update_link() {
    var hash = "#";
    if (!isNaN(conversion_rate) && conversion_rate > 0.0 && conversion_rate < 1.0) {
        hash += "!" + (conversion_rate * 100) + ";" + (power_level * 100) + ";" + (alpha_level * 100) + ";" + (min_effect * 100) + ";" + mde_is_relative;
    }
    $( "#link" ).attr('href', hash);
    $( "#link_field" ).attr('value', location.href.split("#")[0] + hash);
}
function update_input() {
    conversion_rate = $( "#rate" ).val() * 0.01;
    min_effect = $( "#min_effect" ).val() * 0.01;
    mde_is_relative =  parseInt($( "input:radio[name=effect_type]:checked" ).val());
    draw();
}
$(function() {
    if (location.hash.match(/^#!(\d+(?:\.\d+)?);(\d+);(\d+);(\d+(?:\.\d+)?);(\d+)$/) &&
        parseFloat(RegExp.$1) > 0 && parseFloat(RegExp.$1) < 100 &&
        parseInt(RegExp.$2) >= 1 && parseInt(RegExp.$2) <= 99 &&
        parseInt(RegExp.$3) >= 1 && parseInt(RegExp.$3) <= 99 &&
        parseInt(RegExp.$4) >= 1 && parseInt(RegExp.$4) <= 99) {
        conversion_rate = parseFloat(RegExp.$1) * 0.01;
        power_level = parseInt(RegExp.$2) * 0.01;
        alpha_level = parseInt(RegExp.$3) * 0.01;
        min_effect = parseFloat(RegExp.$4) * 0.01;
        mde_is_relative = parseInt(RegExp.$5);
    }
    $( "#rate" ).keyup(function(event) {
        update_input();
    });
    $( "#rate" ).val(conversion_rate * 100);

    $( "#min_effect" ).keyup(function(event) {
        update_input();
    });
    $( "#min_effect" ).val(min_effect * 100);

    $( "input:radio[name=effect_type]" ).change(function(event) {
        update_input();
    });
    $( "input:radio[name=effect_type]" ).filter('[value="'+mde_is_relative+'"]').attr('checked', 'checked');

    $( "#alpha_slider" ).slider({
        value: alpha_level,
        min: min_alpha,
        max: max_alpha,
        step: step_alpha,
        slide: function( event, ui ) {
            alpha_level = ui.value;
            $( "#alpha_value" ).html(Math.round(ui.value * 100) + "%");
            draw();
        }
    });
    $( "#alpha_value" ).html( Math.round($( "#alpha_slider" ).slider( "value" ) * 100) + "%" );

    $( "#power_slider" ).slider({
        value: power_level,
        min: min_power,
        max: max_power,
        step: step_power,
        slide: function( event, ui ) {
            power_level = ui.value;
            $( "#power_value" ).html( Math.round(ui.value * 100) + "%" );
            draw();
        }
    });
    $( "#power_value" ).html( Math.round($( "#power_slider" ).slider( "value" ) * 100) + "%" );

    $( "#link" ).click(function(event) {
        $( "#dialog" ).dialog({
        modal: true,
        minWidth: 540,
        minHeight: 240,
        maxHeight: 240,
        buttons: [ {
                     text: "OK",
        click: function() {
            $( this ).dialog( "close" );
        }
    }
    ]
    });
    });

    draw();
});

